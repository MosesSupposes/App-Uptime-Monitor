/**
 * Create and export configuration variables
 */

 // Container for all the environments
 const environments = {
    // default environment
    staging: { 
        port: 3000,
        envName: 'staging',
    },

    production: {
        port: 5000,
        envName: 'production'
    }
 };

// Determine which environment was passed as a command-line argument
const currentEnvironment = 
    typeof(process.env.NODE_ENV) == 'string' 
        ? process.env.NODE_ENV.toLowerCase() 
        : '';

// Check that the current environment is one of the environments above; if not, default to staging
const environmentToExport = 
    typeof(environments[currentEnvironment]) == 'object'
        ? environments[currentEnvironment] 
        : environments.staging;

module.exports = environmentToExport;