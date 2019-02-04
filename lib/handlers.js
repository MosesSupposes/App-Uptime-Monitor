/**
 * Request handlers
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

const handlers = {
    ping(data, cb) {
        cb(200);
    },

    users(data, cb) {
        const acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._users[data.method](data, cb);
        } else {
            cb(405);
        }
    },

    // Container for the users submethods
    _users: {
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
                handlers._tokens.verifyToken(token, phone, tokenIsValid => {
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
                    requiredDataType: 'string',
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
                                    console.log(err);
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
                } 
            } = data;
            // Check for the required field
            const validPhoneNumber = auditParam(phone, 'string', {requiredLength: 10, operator: '==='});

            // Check for optional fields
            const auditedFields = auditRequiredFields([{param: firstName}, {param: lastName}, {param: password}], 1).auditedFields;
                
            const atLeastOneValidOptionalField = auditedFields.some(field => field);

            // Error if the phone is invalid
            if (validPhoneNumber) {
                // Error if nothing is sent to update
                if (atLeastOneValidOptionalField) {
                    // Get the token from the headers
                    const { headers: { token } } = data;

                    handlers._tokens.verifyToken(token, phone, tokenIsValid => {
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
        // @TODO Cleanup (delete) any other data files associated with this user
        delete(data, cb) {
            const { queryStringObject: { phone }, headers: { token } } = data;
            // Check that the provided phone number is valid
            const validPhoneNumber = helpers.auditParam(phone, 'string', { requiredLength: 10, operator: '=='});
            if (validPhoneNumber) {
                handlers._tokens.verifyToken(token, phone, tokenIsValid => {
                    if (tokenIsValid) {
                        // Lookup the user
                        _data.read('users', phone, (err, data) => {
                            if (!err && data) {
                                // User found
                                _data.delete('users', phone, err => {
                                    if (!err) {
                                        cb(200);
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
    
    // Tokens
    tokens(data, cb) {
        const acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._tokens[data.method](data, cb);
        } else {
            cb(405);
        }
    },

    // Container for the tokens submethods
    _tokens: {
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
                    requiredDataType: 'string', 
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
                    requiredDataType: 'string', 
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
            ], 2).auditPassed;

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

    // Checks
    checks(data, cb) {
        const acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._checks[data.method](data, cb);
        } else {
            cb(405);
        }
    },

    // Container for all the checks methods
    _checks: {
        get() {

        },

        // Required data: protocol: string, url: string, method: string, successCodes: array, timoutSeconds: number 
        // Optional data: none
        post(data, cb) {
            const { 
                payload: { 
                    protocol, url, method, successCodes, timeoutSeconds
                },
                headers : { token }
            } = data;

            // Validate inputs
            const validProtocol = ['https', 'http'].includes(protocol);
            const validMethod = ['get', 'post', 'put', 'delete'].includes(method);
            const validTimeout = (typeof(timeoutSeconds) == 'number') && 
                (timeoutSeconds % 1 === 0) && (timeoutSeconds >= 1 && timeoutSeconds <= 5);
            const validRemainingInputs = helpers.auditRequiredFields([
                { 
                    param: url, 
                    requiredDataType: 'string', 
                    compareOptions: null 
                },
                { 
                    param: successCodes,
                    requiredDataType: 'array',
                    compareOptions: {
                        requiredLength: 0,
                        operator: '>'
                    }
                }
            ], 2).auditPassed;

            if (validProtocol && validMethod && validTimeout &&  validRemainingInputs) {
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

        put() {

        },

        delete() {

        }


    },

    notFound(data, cb) {
        console.log(data);
        cb(404);
    }
};

module.exports = handlers;