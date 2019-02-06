/**
 * Helpers for various tasks
 */

// Dependencies
const crypto = require('crypto');
const config = require('./config');
const https = require('https');
const querystring = require('querystring');

const helpers = {
    // Create a SHA256 hash
    hash(str) {
        const validParam = helpers.auditParam(str);
        return (validParam) ? 
            // return hashed password
            crypto.createHmac('sha256', config.hashingSecret)
                .update(str)
                .digest('hex')
        : false;
    },

    // Helper for auditParam
    defaultOptions: { requiredLength: 0, operator: '>' },

    // compareOptions data: { requiredLength: int, operator: string }
    auditParam(param, requiredDataType='string', compareOptions=helpers.defaultOptions) {
        // Extract necessary varialbes from input
        if (compareOptions) {
            var customTest;
            switch(typeof(compareOptions)) {
                case 'function':
                    customTest = true;
                    break;
                case 'object': 
                    var { requiredLength, operator } = compareOptions;
                    customTest = false;
                    break;
                default: 
                    console.log('compare options aren\'t valid');
                    compareOptions = false;
            }
        }

        // If caller specifies 'array' as required data type, label it as 'object' for typeof check (see line 73).
        if (requiredDataType == 'array' && param instanceof Array) requiredDataType = 'object';

        // The two functions below are helpers for determining the return value
        function actualLength(param) {
            switch (typeof(param)) {
                case 'string':
                    return param.trim().length;
                case 'number' || 'boolean':
                    return param;
                case 'object':
                    return (param instanceof Array) ?
                        param.length
                    : Object.keys(param).length
                default: return 0;
            }
        }

        function requiredLengthMet(operator, requiredLength, actualLength) {
            switch (operator) {
                case '>': return actualLength > requiredLength;
                case '<': return actualLength < requiredLength;
                case '<=': return actualLength <= requiredLength;
                case '>=': return actualLength >= requiredLength;
                case '==': return actualLength == requiredLength;
                case '===': return actualLength === requiredLength;
                default: return actualLength > requiredLength;
            }
        }

        return typeof(param) == requiredDataType ? 
            (compareOptions) ? 
                (customTest) ? 
                    compareOptions(param)
                : requiredLengthMet(operator, requiredLength, actualLength(param))
            : true
        : false;
    },

    auditRequiredFields(fields = [], minRequiredFields=2) {
        const { auditParam } = helpers;
        const auditedFields = Array.from(fields)
            .map(field => {
                const { param, requiredDataType, compareOptions } = field;
                if (param && requiredDataType && compareOptions) {
                    return auditParam(param, requiredDataType, compareOptions);
                } else if (param && requiredDataType && !compareOptions) {
                    return auditParam(param, requiredDataType);
                } else if (!requiredDataType || !compareOptions) {
                    return auditParam(param);
                } else {
                    return false;
                }
            })
            .filter(field => field);
        // the minimum required fields were provided and each field passed the audit
        const minRequiredFieldsMet = auditedFields.length >= minRequiredFields;
        const auditPassed = (minRequiredFieldsMet) &&
            (auditedFields.length == fields.length)
        return {
            auditPassed, 
            auditedFields, 
            minRequiredFieldsMet
        };
    },

    isAWholeNumber(value) {
        return value % 1 === 0;
    },

    isBetweenRange(value, min, max) {
        return (value >= min) && (value <= max);
    },

    // Parse a JSON string to an object in all cases, without throwing
    parseJsonToObject(str) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return {};
        }
    },

    // Create a string of random alphanumeric characters of a given length
    createRandomString(strLength) {
        // Check if string length is greater than 0
        validStrLength = helpers.auditParam(strLength, 'number', {
            operator: '>', 
            requiredLength: 0
        });

        if (validStrLength) {
            // If so, generate and return a random string of letters and numbers
            const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
            var str = '';
            for (let i = 1; i <= strLength; i++) {
                let randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
                str += randomCharacter;
            }
            return str;
        } else {
            return false;
        }
    },

    // Send an SMS via Twilio
    sendTwilioSms(phone, msg, cb) {
        // Validate the parameters
        const validParams = helpers.auditRequiredFields([
            {
                param: phone, 
                requiredDataType: 'string', 
                compareOptions: {
                    requiredLength: 10,
                    operator: '==='
                }
            }, 
            {
                param: msg,
                requiredDataType: 'string',
                compareOptions: msg => (msg.trim().length > 0) && (msg.trim().length <= 1600)
            }
        ], 2);

        if (validParams) {
            // Configure the request payload
            const payload = {
                From: config.twilio.fromPhone,
                To: `+1${phone}`,
                Body: msg
            };
            // Stringify the payload
            const stringPayload = querystring.stringify(payload);
            // Configure the request details
            const requestDetails = {
                protocol: 'https:',
                hostname: 'api.twilio.com',
                method: 'POST',
                path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
                auth: `${config.twilio.accountSid}:${config.twilio.authToken}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(stringPayload)
                }
            };

            // Instantiate the request object
            const req = https.request(requestDetails, res => {
                // Grab the status of the sent request
                const { statusCode: status } = res;
                // Callback successfully if the request went through
                (status == 200 || status == 201) ? cb(false) : cb(`Status code returned: ${status}`);
            });

            // Bind to the error event so it doesn't get thrown
            req.on('error', e => cb(e));
            // Add the payload and end the request
            req.write(stringPayload)
            req.end();
        } else {
            cb('Given parameters were missing or invalid');
        }
    }
};

module.exports = helpers;