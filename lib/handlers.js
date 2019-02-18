/**
 * =================
 * Request handlers
 * =================
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

const allRequests = ['get', 'post', 'put', 'delete'];

// Conatiner for all handlers
const handlers = {
    // Universal response for all 404 requests
    notFound(data, cb) {
        cb(404);
    }
};

/**-------------
 * HTML handlers
 --------------*/

handlers.htmlHandlers = {
    // Homepage
    index(data, cb) {
        handleRequest('html', data, 'get', cb);
    },

    // Create new account
    accountCreate(data, cb) {
        handleRequest('html', data, 'get', cb);
    },

    // Edit account settings
    accountEdit(data, cb) {
        handleRequest('html', data, 'get', cb);
    },

    // Destination after account has been deleted
    accountDeleted(data, cb) {
        handleRequest('html', data, 'get', cb);
    },

    // Create new session
    sessionCreate(data, cb) {
        handleRequest('html', data, 'get', cb);
    },

    // Inform the user they've been logged out
    sessionDeleted(data, cb) {
        handleRequest('html', data, 'get', cb);
    },

    // Create a new check
    checksCreate(data, cb) {
        handleRequest('html', data, 'get', cb);
    },

    // icon for the browser
    favicon(data, cb) {
        (data.method == 'get') ?
            // Read in the favicon's data
            helpers.getStaticAsset('favicon.ico', (err, data) => {
                (!err && data) ? cb(200, data, 'favicon') : cb(500); 
            })
        : cb(405);
    },

    // Public assets
    public(data, cb) {
        // Reject any request that isnt' a get
        if (data.method == 'get') {
            // Get the filename being requested
            const trimmedAssetName = data.path.replace('public/', '').trim();
            if (trimmedAssetName.length > 0) {
                // Read in the asset's data
                helpers.getStaticAsset(trimmedAssetName, (err, data) => {
                    if (!err && data) {
                        // Determine the content type (default to plain text)
                        let contentType = 'plain';
                        if (trimmedAssetName.includes('.css')) {
                            contentType = 'css';
                        }
                        if (trimmedAssetName.includes('.png')) {
                            contentType = 'png';
                        }
                        if (trimmedAssetName.includes('.jpg')) {
                            contentType = 'jpg';
                        }
                        if (trimmedAssetName.includes('.ico')) {
                            contentType = 'favicon';
                        }
                        if (trimmedAssetName.includes('.gif')) {
                            contentType = 'gif';
                        }
                        // Callback the data
                        cb(200, data, contentType);
                    } else {
                        cb(404, data);
                    }
                });
            } else {
                cb(404);
            }
        } else {
            cb(405);
        } 
    }
};


/**-------------------
 * JSON API handlers
 --------------------*/

handlers.jsonHandlers = {
    // Handler for '/ping'
    ping(data, cb) {
        cb(200);
    },

    // Handler for /users
    users(data, cb) {
        handleRequest('json', data, allRequests, cb)
    },

    // Handler for /tokens
    tokens(data, cb) {
        handleRequest('json', data, allRequests, cb)
    },

    // Handler for '/checks'
    checks(data, cb) {
        handleRequest('json', data, allRequests, cb)
    },
};

/**----------------------------
 * JSON sub methods (helpers)
 -----------------------------*/

const _jsonSubMethods = {
    users: {
        // Required data: phone: string
        // Optional data: none
        get(data, cb) {
            const { queryStringObject: { phone } } = data;
            // Check that the provided phone number is valid
            const validPhoneNumber = helpers.auditParam(phone, 'string', { requiredLength: 10, operator: '=='});
            if (validPhoneNumber) {
                // Get the token from the headers
                const { headers: { token } } = data;
                // Verify that the given token is linked to the given phone number
                _jsonSubMethods.tokens.verifyToken(token, phone, tokenIsValid => {
                    if (tokenIsValid) {
                        // Lookup the user
                        _data.read('users', phone, (err, userData) => {
                            if (!err && userData) {
                                // User found
                                // Remove the hashed password from the user object before returning it to the requester
                                delete userData.hashedPassword;
                                cb(200, userData);
                            } else {
                                cb(404);
                            }
                        });
                    } else {
                        cb(403, {Error: 'Missing required token in header, or token is invalid'});
                    }
                });
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        },

        // Required data: firstName: string, lastName: string, phone: string, password: string, tosAgreement: bool
        // Optional data: none
        post(data, cb) {
            const { auditRequiredFields, hash } = helpers;
            const { 
                payload: { 
                    firstName, 
                    lastName,
                    phone,
                    password,
                    tosAgreement
                } 
            } = data;
            
            const requiredFields = [
                { param: firstName, },
                { param: lastName },
                // @TODO: enforce stricter password rules 
                { param: password },
                { 
                    param: phone,
                    compareOptions: { 
                        requiredLength: 10,
                        operator: '==' 
                    }
                },
                {
                    param: tosAgreement,
                    requiredDataType: 'boolean',
                    compareOptions: null
                }
            ];
            // Make sure all required fields are valid
            const allRequiredFieldsPass = auditRequiredFields(requiredFields).auditPassed;

            if (allRequiredFieldsPass) {
                // Make sure that the user doesn't already exist
                _data.read('users', phone, (err, data) => {
                    if (err) {
                        // User doesn't exist
                        // Hash the password
                        const hashedPassword = hash(password);
                        if (hashedPassword) {
                            // Create the user object
                            const userObject = {
                                firstName,
                                lastName,
                                phone,
                                hashedPassword,
                                tosAgreement
                            };
                            // Store the user
                            _data.create('users', phone, userObject, err => {
                                if (!err) {
                                    cb(200);
                                } else {
                                    console.error(err);
                                    cb(500, {Error: 'Could not create the new user'});
                                }
                            });
                        } else {
                            cb(500, {Error: 'Could not hash the user\'s password'});
                        }
                    } else {
                        // User already exists
                        cb(400, {Error: 'A user with that phone number already exists'})
                    }
                });

            } else {
                cb(400, {error: 'Missing required fields'});
            }
        },

        // Required data: phone: string
        // Optional data: firstName: string, lastName: string, password: string (at least one must be specified)
        put(data, cb) {
            const { auditParam, auditRequiredFields } = helpers;
            const { 
                payload: { 
                    phone, 
                    firstName, 
                    lastName, 
                    password 
                }, 
                headers: { token }
            } = data;
            // Check for the required field
            const validPhoneNumber = auditParam(phone, 'string', {requiredLength: 10, operator: '==='});

            // Check for optional fields
            const auditedFields = auditRequiredFields([{param: firstName}, {param: lastName}, {param: password}], 1).auditedFields;
                
            const atLeastOneValidOptionalField = auditedFields.some(field => field);

            // Error if the phone (the only required field) is invalid
            if (validPhoneNumber) {
                // Error if nothing is sent to update
                if (atLeastOneValidOptionalField) {
                    _jsonSubMethods.tokens.verifyToken(token, phone, tokenIsValid => {
                    if (tokenIsValid) {
                        // Lookup the user
                        _data.read('users', phone, (err, userData) => {
                            if (!err && userData) {
                                // Update the necessary fields
                                Object.entries(data.payload)
                                    .forEach(entry => {
                                        const [ key, value ] = entry;
                                        switch(key) {
                                            case 'password':
                                                userData.hashedPassword = helpers.hash(value);
                                                break;
                                            case'newNumber':
                                                userData.phone = value;
                                                break;
                                            default: userData[key] = value;
                                        }
                                    });
                                
                                // Store the new updates
                                _data.update('users', phone, userData, err => {
                                    if (!err) {
                                        // @TODO: if a new number was added, update the file name to reflect that change
                                        cb(200);
                                    } else {
                                        cb(500, {Error: 'Could not update the user \n\n', e});
                                    }
                                });
                            } else {
                                cb(400, {Error: 'The specified user does not exist'});
                            }
                        });
                    } else {
                        cb(403, {Error: 'Missing required token in header, or token is invalid'});
                    }
                });
                } else {
                    cb(400, {Error: 'Missing fields to update'});
                }
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        },

        // Required field: phone
        delete(data, cb) {
            const { queryStringObject: { phone }, headers: { token } } = data;
            // Check that the provided phone number is valid
            const validPhoneNumber = helpers.auditParam(phone, 'string', { requiredLength: 10, operator: '=='});
            if (validPhoneNumber) {
                _jsonSubMethods.tokens.verifyToken(token, phone, tokenIsValid => {
                    if (tokenIsValid) {
                        // Lookup the user
                        _data.read('users', phone, (err, userData) => {
                            if (!err && userData) {
                                // User found
                                _data.delete('users', phone, err => {
                                    if (!err) {
                                        // Delete each of the checks associated with the user
                                        const userChecks = helpers.auditParam(userData.checks, 'array', {operator: '>', requiredLength: '0'}) ?
                                            userData.checks
                                        : [];
                                        const checksToDelete = userChecks.length;
                                        if (checksToDelete > 0) {
                                            let checksDeleted = 0;
                                            let deletionErrors = false;
                                            // Loop through the user's checks and delete them
                                            userChecks.forEach(checkId => {
                                                _data.delete('checks', checkId, err => {
                                                    if (err) {
                                                        deletionErrors = true;
                                                    }
                                                    checksDeleted++;
                                                    (checksDeleted = checksToDelete) &&
                                                        (!deletionErrors) ? 
                                                            cb(200) 
                                                        : cb(500, {Error: 'Errors encountered while attempting to delete all of the user\'s checks. All checks may not have been deleted from the system successfully.'});
                                                });
                                            });
                                        } else {
                                            // No checks to delete, success
                                            cb(200);
                                        }
                                    } else {
                                        cb(500, {Error: 'Could not delete the specified user'});
                                    }
                                });
                            } else {
                                cb(400, {Error: 'Could not find the specified user'});
                            }
                        });
                    } else {
                        cb(403, {Error: 'Missing required token in header, or token is invalid'});
                    }
                });
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        }
    }, 

    tokens: {
        // Required data: id: string
        // Optional data: none
        get(data, cb) {
            const { queryStringObject: { id } } = data;
            // Check that the provided phone number is valid
            const validId = helpers.auditParam(id, 'string', { requiredLength: 20, operator: '=='});
            if (validId) {
                // Lookup the token
                _data.read('tokens', id, (err, tokenData) => {
                    if (!err && tokenData) {
                        // User found
                        cb(200, tokenData);
                    } else {
                        cb(404);
                    }
                });
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        },

        // Required data: phone: string, password: string
        // Optional data: none
        post(data, cb) {
            const { payload: { password, phone } } = data;
            // Check for validity of required fields
            const validParams = helpers.auditRequiredFields([
                {param: password},
                {
                    param: phone, 
                    compareOptions: {
                        requiredLength: 10,
                        operator: '=='
                    }
                },
            ], 2).auditPassed;
            if (validParams) {
                // Lookup the user who matches that phone number
                _data.read('users', phone, (err, userData) => {
                    if (!err && userData) {
                        // Hash the sent password and compare it to the password stored in the user object
                        const passwordsMatch = helpers.hash(password) === userData.hashedPassword;
                        if (passwordsMatch) {
                            // If valid, create a new token with a random name. Set expiration data to 1 hour in the future.
                            const tokenId = helpers.createRandomString(20);
                            const expires = Date.now() + 1000 * 60 * 60;
                            const tokenObj = {
                                phone,
                                id: tokenId,
                                expires
                            };

                            // Store the token
                            _data.create('tokens', tokenId, tokenObj, err => {
                                if (!err) {
                                    cb(200, tokenObj);
                                } else {
                                    cb(500, {Error: 'Could not create the new token'});
                                }
                            });
                        } else {
                            cb(400, {Error: 'Password did not match the specified user\'s stored password'});
                        }
                    } else {
                        cb(400, {Error: 'Could not find the specified user'});
                    }
                });
            } else {
                cb(400, {Error: 'Missing required fields'});
            }
        },

        // Required data: id: string, extend: bool
        // Optional data: none
        put(data, cb) {
            const { payload: { id, extend } } = data;
            const validParams = helpers.auditRequiredFields([
                {
                    param: id,
                    compareOptions: { 
                        requiredLength: 20, 
                        operator: '=='
                    }
                }, 
                {
                    param: extend, 
                    requiredDataType: 'boolean', 
                    compareOptions: null
                }
            ]).auditPassed;

            if (validParams) {
                // Lookup the token
                _data.read('tokens', id, (err, tokenData) => {
                    if (!err && tokenData) {
                        // Check to make sure the token isn't already expired
                        if (tokenData.expires > Date.now()) {
                            // Set the expiration an hour from now
                            tokenData.expires = Date.now() + 1000 * 60 * 60;

                            // Store the new updates
                            _data.update('tokens', id, tokenData, err => {
                                (!err) 
                                    ? cb(200) 
                                    : cb(500, {Error: 'Could not extend the token\'s expiration'});
                            });
                        } else {
                            cb(400, {Error: 'The token has already expired, and therefore cannot be extended'});
                        }
                    } else {
                        cb(400, {Error: 'Specified token does not exist'});
                    }
                });
            } else {
                cb(400, {Error: 'Missing required field(s) or field(s) are invalid'});
            }
        },

        // Required data: id: 'string'
        // Optional data: none
        // Deleting a token is essentially logging out
        delete(data, cb) {
            const { queryStringObject: { id } } = data;
            // Check for valid id
            const validId = helpers.auditParam(id, 'string', { requiredLength: 20, operator: '=='});
            if (validId) {
                // Lookup the token
                _data.read('tokens', id, (err, tokenData) => {
                    if (!err && tokenData) {
                        // Token found
                        _data.delete('tokens', id, err => {
                            if (!err) {
                                cb(200);
                            } else {
                                cb(500, {Error: 'Could not delete the specified token'});
                            }
                        });
                    } else {
                        cb(400, {Error: 'Could not find the specified token'});
                    }
                });
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        },

        // Verify if a given token id is currently valid for a given user
        verifyToken(id, phone, cb) {
            // Lookup the token
            _data.read('tokens', id, (err, tokenData) => {
                (!err && tokenData) ?
                    // Check whether the token is linked to the given user and hasn't yet expired
                    (tokenData.phone == phone && tokenData.expires > Date.now()) ? 
                        cb(true)
                    : cb(false)
                : cb(false);
            });
        }
    },

    checks: {
        // Required data: id: string
        // Optional data: none
        get(data, cb) {
            const { queryStringObject: { id }, headers: { token } } = data;
            // Check that the provided phone number is valid
            const validId = helpers.auditParam(id, 'string', { requiredLength: 20, operator: '=='});
            if (validId) {
                // Lookup the check
                _data.read('checks', id, (err, checkData) => {
                    if (!err && checkData) {
                        // Verify that the given token is valid and belongs to the user who created the check
                        _jsonSubMethods.tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
                            (tokenIsValid) ? cb(200, checkData) : cb(403);
                        })
                    } else {
                        cb(404);
                    } 
                })
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        },

        // Required data: protocol: string, url: string, method: string, successCodes: array, timoutSeconds: number 
        // Optional data: none
        post(data, cb) {
            const { 
                payload: { 
                    protocol, 
                    url, 
                    method, 
                    successCodes, 
                    timeoutSeconds
                },
                headers : { token }
            } = data;
            const { 
                isAWholeNumber, 
                isBetweenRange, 
                auditRequiredFields 
            } = helpers;

            // Validate inputs
            const validInputs = auditRequiredFields([
                // Audits whether length is > 0 by default if no compare options are provided
                { param: url },
                { param: successCodes, requiredDataType: 'array' },
                {
                    param: protocol,
                    compareOptions: protocol => ['https', 'http'].includes(protocol)
                },
                {
                    param: method,
                    compareOptions: method => ['get', 'post', 'put', 'delete'].includes(method)
                },
                {
                    param: timeoutSeconds,
                    requiredDataType: 'number',
                    compareOptions: timeoutSeconds => isAWholeNumber(timeoutSeconds) &&
                        isBetweenRange(timeoutSeconds, 1, 5)
                }
            ], 5).auditPassed;

            if (validInputs) {
                // Lookup the user by reading the token
                _data.read('tokens', token, (err, tokenData) => {
                    if (!err && tokenData) {
                        const userPhone = tokenData.phone;
                        // Lookup the user data
                        _data.read('users', userPhone, (err, userData) => {
                            if (!err && userData) {
                                // Discover how many checks the user has performed
                                const userChecks = helpers.auditParam(userData.checks, 'array', null) ? userData.checks : []; 
                                // Verify whether the user has any remaining checks available
                                if (userChecks.length < config.maxChecks) {
                                    // Create a random id for the check
                                    const checkId = helpers.createRandomString(20);
                                    // Create the check object, and include the user's phone
                                    const checkObj = {
                                        id: checkId,
                                        userPhone,
                                        protocol,
                                        url,
                                        method,
                                        successCodes,
                                        timeoutSeconds
                                    };

                                    // Save the object
                                    _data.create('checks', checkId, checkObj, err => {
                                        if (!err) {
                                            // Add the check id to the user's object
                                            userData.checks = userChecks;
                                            userData.checks.push(checkId);

                                            // Save the new user data
                                            _data.update('users', userPhone, userData, err => {
                                                if (!err) {
                                                    // Return the data about the new check to the requester
                                                    cb(200, checkObj);
                                                } else {
                                                    cb(500, {Error: 'Could not update the user with the new check'});
                                                }
                                            });
                                        } else {
                                            cb(500, {Error: 'Could not create the new check'});
                                        }
                                    });
                                } else {
                                    cb(400, {Error: `The user has already performed the maximun number of checks: (${config.maxChecks})`});
                                }
                            } else {
                                cb(403);
                            }
                        });
                    } else {
                        cb(403);
                    }
                });
            } else {
                cb(400, {Error: 'Missing required inputs, or inputs are invalid'});
            }
        },

        // Required data: id: string
        // Optional data: protocol: string, url: string, method: string, successCodes: array, timeoutSeconds: number (at least one must be set)
        put(data, cb) {
            const { 
                auditParam, 
                auditRequiredFields, 
                isAWholeNumber, 
                isBetweenRange
            } = helpers;
            const { 
                payload: { 
                    id, 
                    protocol, 
                    url,
                    method, 
                    successCodes,
                    timeoutSeconds
                },
                headers: { token } 
            } = data;
            // Validate required field
            const validId = auditParam(id, 'string', {requiredLength: 20, operator: '=='});
            // Validate optional fields
            const auditedOptionalFields = auditRequiredFields([
                { param: url },
                { param: successCodes, requiredDataType: 'array' },
                {
                    param: protocol,
                    compareOptions: protocol => ['http', 'https'].includes(protocol)
                },
                {
                    param: timeoutSeconds,
                    requiredDataType: 'number',
                    compareOptions: timeoutSeconds => isAWholeNumber(timeoutSeconds)&& 
                        isBetweenRange(timeoutSeconds, 1, 5)
                },
                { 
                    param: method,
                    compareOptions: method => ['get', 'post', 'put', 'delete'].includes(method)
                }
            ], 1).auditedFields;

            const atLeastOneValidOptionalField = auditedOptionalFields.some(field => field);

            // Error if the id (the only required field) is invalid
            if (validId) {
                // Error if nothing is sent to update
                if (atLeastOneValidOptionalField) {
                    // Lookup the check
                    _data.read('checks', id, (err, checkData) => {
                        if (!err && checkData) {
                            _jsonSubMethods.tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
                                if (tokenIsValid){
                                    // Update the necessary fields
                                    Object.entries(data.payload)
                                        .forEach(entry => {
                                            const [ key, value ] = entry;
                                            checkData[key] = value;
                                        });

                                    // Store the updates
                                    _data.update('checks', id, checkData, err => {
                                        (!err) ? cb(200) : cb(500, {Error: 'Could not update the check'});
                                    });
                                } else {
                                    cb(403);
                                } 
                            });
                        } else {
                            cb(400, {Error: 'Check ID did not exist'});
                        }
                    });
                } else {
                    cb(400, {Error: 'Missing fields to update'});
                }
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        },

        // Required data: id: string
        // Optional data: none
        delete(data, cb) {
            const { queryStringObject: { id }, headers: { token } } = data;
            // Verify wheter the provided id is valid
            const validId = helpers.auditParam(id, 'string', { requiredLength: 20, operator: '=='});
            if (validId) {
                // Lookup the check
                _data.read('checks', id, (err, checkData) => {
                    if (!err && checkData) {
                        const { userPhone } = checkData;
                        // Verify token 
                        _subMethods.tokens.verifyToken(token, userPhone, tokenIsValid => {
                            if (tokenIsValid) {
                                // Delete the check data
                                _data.delete('checks', id, err => {
                                    if (!err) {
                                        // Lookup the user
                                        _data.read('users', userPhone, (err, userData) => {
                                            if (!err && userData) {
                                                // User found
                                                // Reference list of user's checks
                                                let userChecks = helpers.auditParam(userData.checks, 'array', {requiredLength: 0, operator: '>'}) ? 
                                                    userData.checks 
                                                : [];
                                                // Remove the deleted check from associated user's list of checks
                                                const checkPosition = userChecks.indexOf(id);
                                                if (checkPosition > -1) {
                                                    userChecks.splice(checkPosition, 1)
                                                    // Re-save the user's data
                                                    userData.checks = userChecks;
                                                    _data.update('users', userPhone, userData, err => {
                                                        (!err) ? cb(200) : cb(500, {Error: 'Could not update the specified user'});
                                                    });
                                                }
                                                else {
                                                    cb(500, {Error: 'Could not find the check on the user\'s object, so could not remove it'});
                                                }
                                            } else {
                                                cb(500, {Error: 'Could not find the user who created the check, therefore could not remove the check from the list of checks on the user object'});
                                            }
                                        });
                                    } else {
                                        cb(500, {Error: 'Could not delete the check data'});
                                    }
                                });
                            } else {
                                cb(403);
                            }
                        });
                    } else {
                        cb(400, {Error: 'The specified check id does not exist'});
                    }
                });
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        }
    }
};


/**----------------------------
 * HTML sub methods (helpers)
 -----------------------------*/

const _htmlSubMethods = {
    // Index page
    '': {
        get(data, cb) {
            // Prepare data for interpolation
            const templateData = {
                'head.title': 'Uptime Monitoring - Made Simple',
                'head.description': 'We offer free, simple uptime monitoring                        for HTTP/HTTPS sites of all kinds. When                        your site goes down, we\'ll shoot you a                        text to let you know.',
                'body.class': 'index'
            }
            // Respond with the template
            helpers.respondWithTemplate('index', templateData, cb);
        }
    },

    'account/create': {
        get(data, cb) {
            // Prepare data for interpolation
            const templateData = {
                'head.title': 'Create Your Account',
                'head.description': 'Sign up is easy and only takes a few seconds',
                'body.class': 'accountCreate'
            }
            // Respond with the template
            helpers.respondWithTemplate('accountCreate', templateData, cb);
        }
    },

    'account/edit': {
        get(data, cb) {
            // Prepare data for interpolation
            const templateData = {
                'head.title': 'Account Settings',
                'body.class': 'accountEdit'
            }
            // Respond with the template
            helpers.respondWithTemplate('accountEdit', templateData, cb);
        }
    },
    
    'account/deleted': {
        get(data, cb) {
            // Prepare data for interpolation
            const templateData = {
                'head.title': 'Account Deleted',
                'head.description': 'Your account has been deleted',
                'body.class': 'accountDeleted'
            };
            // Respond with the template
            helpers.respondWithTemplate('accountDeleted', templateData, cb);
        }
    },
    
    'session/create': {
        get(data, cb) {
            // Prepare data for interpolation
            const templateData = {
                'head.title': 'Login To Your Account',
                'head.description': 'Please enter your phone number and password to access your account',
                'body.class': 'sessionCreate'
            }
            // Respond with the template
            helpers.respondWithTemplate('sessionCreate', templateData, cb);
        }
    },
    
    'session/deleted': {
        get(data, cb) {
            // Prepare data for interpolation
            const templateData = {
                'head.title': 'Logged Out',
                'head.description': 'You have been logged out of your account',
                'body.class': 'sessionDeleted'
            }
            // Respond with the template
            helpers.respondWithTemplate('sessionDeleted', templateData, cb);
        }
    },
    
    'checks/create': {
        // Prepare data for interpolation
        get(data, cb) {
            const templateData = {
                'head.title': 'Create a New Check',
                'body.class': 'checksCreate'
            }
            // Respond with the template
            helpers.respondWithTemplate('checksCreate', templateData, cb);
        }
    }
};

function handleRequest(handler, data={}, acceptableRequests=allRequests, cb, statusCodeOnFail=405) {
    var { path, method: receivedRequest } = data;
    var subMethodToUse, subMethods;

    switch (handler) {
        case 'json': 
            subMethodToUse = subMethods = _jsonSubMethods;
                // All json handlers are on the route 'api/something',
                // so get rid of the 'api' part and only include the path name
                path = path.slice(path.indexOf('/') + 1);
            break;
        case 'html': 
            subMethodToUse = subMethods = _htmlSubMethods;
            // We don't modify the path here because all html handlers have unique paths.
            break;
        default: 
            subMethodToUse = subMethods = null;
    }

    // Call the appropriate handler with data and a cb
    acceptableRequests.includes(receivedRequest) && subMethodToUse ? 
        subMethods[path][receivedRequest](data, cb) 
    : cb(statusCodeOnFail, {Error: `this handler doesn't accept the specified path: (${path}), request: (${receivedRequest.toUpperCase()}), or you passed an invalid handler: (${handler})`}, handler);
}


module.exports = handlers;