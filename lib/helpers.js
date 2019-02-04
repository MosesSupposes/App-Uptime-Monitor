/**
 * Helpers for various tasks
 */

// Dependencies
const crypto = require('crypto');
const { hashingSecret } = require('./config');

const helpers = {
    // Create a SHA256 hash
    hash(str) {
        const validParam = helpers.auditParam(str);
        return (validParam) 
            // return hashed password
            ? crypto
                .createHmac('sha256', hashingSecret)
                .update(str)
                .digest('hex')
            : false;
    },

    requiredLengthMet(operator, requiredLength, actualLength) {
        switch (operator) {
            case '>': return actualLength > requiredLength;
            case '<': return actualLength < requiredLength;
            case '<=': return actualLength <= requiredLength;
            case '>=': return actualLength >= requiredLength;
            case '==': return actualLength == requiredLength;
            case '===': return actualLength === requiredLength;
            default: return actualLength > requiredLength;
        }
    },

    // Helper for auditParam
    defaultOptions: { requiredLength: 0, operator: '>' },

    // compareOptions data: { requiredLength: int, operator: string }
    auditParam(param, requiredDataType='string', compareOptions=helpers.defaultOptions) {
        if (compareOptions) {
            var { requiredLength, operator } = compareOptions;
        } else { 
            var requiredLength = false;
        }

        // Helper
        function actualLength(param) {
            switch (typeof(param)) {
                case 'string':
                    return param.trim().length;
                    case 'number' || 'boolean':
                    return param;
                default: return 0;
            }
        }

        return typeof(param) == requiredDataType 
            ? (requiredLength) 
                ? helpers.requiredLengthMet(operator, requiredLength, actualLength(param))
                : true
            : false;
    },

    auditRequiredFields(fields = [], minRequiredFields=5) {
        const { auditParam } = helpers;
        const auditedFields = Array.from(fields)
            .map(field => {
                const { param, requiredDataType, compareOptions } = field;
                if (param && requiredDataType && compareOptions) {
                    return auditParam(param, requiredDataType, compareOptions);
                } else if (param && requiredDataType && !compareOptions) {
                    return auditParam(param, requiredDataType, null)
                } else if (!requiredDataType || !compareOptions) {
                    return auditParam(param);
                } else {
                    return false;
                }
            })
            .filter(field => field);
        // the minimum required fields were provided and each field passed the audit
        const auditPassed = (auditedFields.length >= minRequiredFields) 
            && (auditedFields.length == fields.length)
        return {auditPassed, auditedFields};
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
        validStrLength = helpers.auditParam(strLength, 'number', {operator: '>', requiredLength: 0});

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
    }
};

module.exports = helpers;