/**
 * Create and export configuration variables
 */

 // Container for all the environments
 const environments = {
    // default environment
    staging: { 
        httpPort: 3000,
        httpsPort: 3001,
        envName: 'staging',
        hashingSecret: 'can\'t say',
        maxChecks: 5,
        twilio: {
            accountSid: 'ACa2e80c77112c5748ea5321a0fae21dcb',
            authToken: 'fdda4a2289ebf72d9dc96b5ce5bbd738',
            fromPhone: '+15163505091'
        },
        templateGlobals: {
            appName: 'uptimeMonitor',
            companyName: 'NotARealCompany, Inc',
            yearCreated: '2019',
            baseUrl: 'http://localhost:3000'
        }
    },

    testing: { 
        httpPort: 4000,
        httpsPort: 4001,
        envName: 'testing',
        hashingSecret: 'shhhh!',
        maxChecks: 5,
        twilio: {
            accountSid: 'ACa2e80c77112c5748ea5321a0fae21dcb',
            authToken: 'fdda4a2289ebf72d9dc96b5ce5bbd738',
            fromPhone: '+15163505091'
        },
        templateGlobals: {
            appName: 'uptimeMonitor',
            companyName: 'NotARealCompany, Inc',
            yearCreated: '2019',
            baseUrl: 'http://localhost:3000'
        }
    },
    
    production: {
        httpPort: 5000,
        httpsPort: 5001,
        envName: 'production',
        hashingSecret: 'sorry, can\'t tell ya',
        maxChecks: 5,
        twilio: {
            accountSid: 'ACa2e80c77112c5748ea5321a0fae21dcb',
            authToken: 'fdda4a2289ebf72d9dc96b5ce5bbd738',
            fromPhone: '+15163505091'
        },
        templateGlobals: {
            appName: 'uptimeMonitor',
            companyName: 'NotARealCompany, Inc',
            yearCreated: '2019',
            baseUrl: 'http://localhost:5000'
        }
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