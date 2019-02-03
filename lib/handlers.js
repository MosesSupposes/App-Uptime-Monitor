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
    
    // Container for the users submethods
    _users: {
        // Required data: phone
        // Optional data: none
        // @TODO: only let an authenticated user access their object. Don't let them access anyone else's.
        get(data, cb) {
            const { queryStringObject: { phone } } = data;
            // Check that the provided phone number is valid
            const validPhoneNumber = helpers.auditParam(phone, 'string', {trimmed: true, requiredLength: [10, '==']}) || false;
            if (validPhoneNumber) {
                // Lookup the user
                _data.read('users', phone, (err, data) => {
                    if (!err && data) {
                        // User found
                        // Remove the hashed password from the user object before returning it to the requester
                        delete data.hashedPassword;
                        cb(200, data);
                    } else {
                        cb(404);
                    }
                });
            } else {
                cb(400, {Error: 'Missing required field'});
            }
        },

        // Required data: firstName, lastName, phone, password, tosAgreement
        // Optional data: none
        post(data, cb) {
            const { auditParam, auditRequiredFields, hash } = helpers;
            const { 
                payload: { 
                    firstName: fn, 
                    lastName: ln,
                    phone: phoneNumber,
                    password: pw,
                    tosAgreement: toa
                } 
            } = data;
            
            // Check whether all required fields are filled out
            const firstName = auditParam(fn);
            const lastName = auditParam(ln);
            const phone = auditParam(phoneNumber, 'string', {trimmed: true, requiredLength: [10, '==']}) && phoneNumber;
            // @TODO: enforce stricter password rules 
            const password = auditParam(pw);
            const tosAgreement = auditParam(toa, 'boolean', null) && true;

            const requiredFields = [firstName, lastName, phone, password, tosAgreement];
            const allRequiredFieldsPass = auditRequiredFields(requiredFields);


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

        put(data, cb) {

        },

        delete(data, cb) {

        }
    }, 
    
    users(data, cb) {
        const acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._users[data.method](data, cb);
        } else {
            cb(405);
        }
    },

    notFound(data, cb) {
        console.log(data);
        cb(404);
    }
};

module.exports = handlers;