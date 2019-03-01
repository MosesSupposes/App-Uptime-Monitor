/**
 * Helpers for various tasks
 */

// Dependencies
const crypto = require('crypto');
const config = require('./config');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');

const helpers = {
    // Create a SHA256 hash
    hash(str) {
        const validParam = this.auditParam(str);
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

        // If caller specifies 'array' as required data type, label it as 'object' for typeof check (see this func's return value).
        if (requiredDataType == 'array' && param instanceof Array) {
            requiredDataType = 'object';
        }

        // The two functions below are helpers for determining the return value
        function determineLengthOf(param) {
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

        // Return true if the required data type and compareOptions were met (compareOptions test defaults to 'length of param > 0' if not specified; gets ignored if explicitly passed null)
        return typeof(param) == requiredDataType ? 
            (compareOptions !== null) ? 
                (customTest) ? 
                    compareOptions(param)
                : requiredLengthMet(operator, requiredLength, determineLengthOf(param))
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
                } else if (param && requiredDataType && compareOptions == null) {
                    return auditParam(param, requiredDataType, null)
                } else if (param && requiredDataType && compareOptions == undefined) {
                    return auditParam(param, requiredDataType);
                } else if (requiredDataType == undefined) {
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
    },

    // Return a list of filenames without extensions
    trimFileExtensions(listOfFiles, properExtensions=['.json']) {
        // TODO: use regex to match last occurence of '.', so as to not get a false positive on the supposed file extension
        return listOfFiles.reduce((files, file) => {
            var fileExtenstion = file.split('.')[1];
            var fileName = file.split('.')[0]
            properExtensions.includes(fileExtenstion) && files.push(fileName);
            return files;
        }, []);
    },

    // Get the string content of a template
    getTemplate(templateName, data={}, cb) {
        const validTemplateName = this.auditParam(templateName);
        const validDataObj = this.auditParam(data, 'object', null);

        if (validTemplateName && validDataObj) {
            const templatesDir = path.join(__dirname,'/../templates');
            fs.readFile(`${templatesDir}/${templateName}.html`, 'utf8', (err, htmlString) => {
                const templateContainsNonEmptyString = this.auditParam(htmlString);
                if (!err && templateContainsNonEmptyString) {
                    // Do interpolation on the string
                    const interpolatedString = this.interpolate(htmlString, data);
                    cb(false, interpolatedString);
                }
                else cb('No template could be found');
            });
        } else cb('A valid template name was not specified');
    },

    // Add the universal header and footer to a string, and pass the provided data object to the header and footer for interpolation
    addUniversalTemplates(str='', data={}, cb) {
        // Get the header
        this.getTemplate('_header', data, (err, headerString) => {
            (!err && headerString) ?
                // Get the footer
                this.getTemplate('_footer', data, (err, footerString) => {
                    (!err && footerString) ?
                        // Wrap the specified template with the header and footer templates
                        cb(false, headerString + str + footerString)
                    : cb('Could not find the footer template')
                })
            : cb('Could not find the header template');
        });
    },

    respondWithTemplate(template, templateData, cb) {
        const validParams = this.auditRequiredFields([
            { param: template },
            { 
                param: templateData, 
                requiredDataType: 'object',
                compareOptions: null
            }
        ], 2).auditPassed;

        (validParams)
            ? this.getTemplate(template, templateData, (err, template) => {
                (!err && template) 
                    // Add the universal header and footer
                    ? this.addUniversalTemplates(template, templateData, (err, fullTemplate) => {
                        (!err && fullTemplate) 
                            // Return the full template as HTML
                            ? cb(200, fullTemplate, 'html')
                            : cb(500, undefined, 'html');
                        })
                    : cb(500, undefined, 'html');
            })
            : cb(500, {Error: `invalid template: ${template} or invalid templateData Object: ${templateData}`}, 'html')
    },

    // Take a given string and a data object and find/replace all the keys within it with the given string
    interpolate(str='', data={}) {
        // Add the template globals to the data object, prepending their key name with "global"
        Object.entries(config.templateGlobals).forEach( ([key, value]) => {
            if(config.templateGlobals.hasOwnProperty(key)) {
                data['global.' + key] = value 
            }
        });

        // Perform the actual interpolation on the str param
        Object.entries(data).forEach( ([key, value]) => str = str.replace(`{${key}}`, value) );
        return str;
    },

    // Get the contents of a static (public) asset
    getStaticAsset(fileName='string', cb) {
        const validFileName = this.auditParam(fileName);
        if (validFileName) {
            const publicDir = path.join(__dirname, '/../public');
            fs.readFile(`${publicDir}/${fileName}`, (err, data) => {
                if (!err && data) {
                    cb(false, data);
                } else {
                    cb('No file could be found');
                }
            });
        } else {
            cb('A valid file name was not specified');
        }
    },

    craftGetRequest(path, cb) {
        // Configure the request details
        const requestDetails = {
            path,
            protocol: 'http:',
            hostname: 'localhost',
            port: config.httpPort,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' } 
        };
        // Send the request
        const req = http.request(requestDetails, res => cb(res));
        req.end()
    },

    // the inverse of Array.filter; also works on objects
    reject(list, rejectionValue) {
        const removeRejectValue = item => item !== rejectionValue;
        if (typeof(list == 'object')) {
            // polyfill for Object.fromEntries, just in case it's not compatible
            const objectFromEntries = arr => Object.assign({}, ...arr.map( ([k, v]) => ({[k]: v}) ));
            return objectFromEntries(Object.entries(list).filter(removeRejectValue));
        }  
        if (!(list instanceof Array)) {
            list = Array.from(list);
        }
        return list.filter(removeRejectValue);
    }
};

module.exports = helpers;