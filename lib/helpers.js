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
        
        return typeof(param) == requiredDataType 
            ? (requiredLength) 
                ? helpers.requiredLengthMet(operator, requiredLength, param.trim().length)
                : param.trim()
            : param
    },

    auditRequiredFields(fields = [], minRequiredFields=5) {
        const auditedFields = Array.from(fields)
            .map(field => {
                const { param, requiredDataType, compareOptions } = field;
                if (param && requiredDataType && compareOptions) {
                    return helpers.auditParam(param, requiredDataType, compareOptions);
                } else if (!requiredDataType || !compareOptions) {
                    return helpers.auditParam(param);
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
    }
};

module.exports = helpers;