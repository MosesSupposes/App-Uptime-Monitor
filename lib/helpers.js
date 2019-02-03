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
    defaultOptions: { trimmed: true, requiredLength: [0] },

    // options data: { trimmed: bool, requiredLength: [length: int, operator: string] }
    auditParam(param, requiredDataType='string', options=helpers.defaultOptions) {
        if (options) {
            var { trimmed, requiredLength: [ requiredLength, operator ] } = options;
        } else {
            var trimmed = false, requiredLength = false;
        }
        
        return typeof(param) == requiredDataType 
            ? (trimmed) 
                ? (requiredLength) 
                    ? helpers.requiredLengthMet(operator, requiredLength, param.trim().length)
                    : param.trim()
                : param
            : false;
    },

    auditRequiredFields(args = []) {
        const requiredFields = Array.from(args);
        const passedFields = requiredFields.filter(field => field);
        return passedFields.length === requiredFields.length;
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