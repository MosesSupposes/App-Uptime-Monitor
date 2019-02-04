/**
 * Request handlers
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');

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
        // @TODO: only let an authenticated user access their object. Don't let them access anyone else's.
        get(data, cb) {
            const { queryStringObject: { phone } } = data;
            // Check that the provided phone number is valid
            const validPhoneNumber = helpers.auditParam(phone, 'string', { requiredLength: 10, operator: '=='});
            if (validPhoneNumber) {
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
        // @TODO Only let an authenticated user opdate their own object. Don't let them update anyone else's.
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
                    cb(400, {Error: 'Missing fields to update'});
                }
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        },

        // Required field: phone
        // @TODO Only let an authenticated user delete their object. Don't let them delete anyone elses
        // @TODO Cleanup (delete) any other data files associated with this user
        delete(data, cb) {
            const { queryStringObject: { phone } } = data;
            // Check that the provided phone number is valid
            const validPhoneNumber = helpers.auditParam(phone, 'string', { requiredLength: 10, operator: '=='});
            if (validPhoneNumber) {
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
            const { payload: {password, phone} } = data;
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
            
        },

        delete(data, cb) {

        }
    },

    notFound(data, cb) {
        console.log(data);
        cb(404);
    }
};

module.exports = handlers;