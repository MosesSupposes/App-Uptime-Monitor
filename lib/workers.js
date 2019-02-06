/**
 * Worker-related tasks
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const http = require('http');
const https = require('https');
const helpers = require('./helpers');
const url = require('url');
const _logs = require('./logs');

const workers = {
    init() {
        // Execute all the checks immediately
        this.gatherAllChecks();
        // Start the interval so subsequent checks will get executed
        this.loop();
    },

    // Log all checks to a file
    log(originalCheckData, checkOutcome, prevState, newState, alertWarranted, timeOfCheck) {
        // Form the log data
        const logData = {
            check: originalCheckData,
            outcome: checkOutcome,
            state: { prev: prevState, current: newState },
            alert: alertWarranted,
            time: timeOfCheck
        };
        // Convert data to a string
        const logString = JSON.stringify(logData);
        // Determine the name of the log file
        const logFileName = originalCheckData.id;
        // Append the log string to the file
        _logs.append(logFileName, logString, err => {
            (!err) ? 
                console.log('Logging to file succeeded')
            : console.log('Logging to the file failed');
        });
    },

    // Timer to execute the worker-process once per minute
    loop() {
        setInterval(() => {
            this.gatherAllChecks();
        }, 1000 * 60);
    },

    // Lookup all checks, get their data, send to a validator
    gatherAllChecks() {
        // Get all the checks that exist in the system
        _data.list('checks', (err, checks) => {
            // also audits whether the length is greater than 0 by default
            const thereAreChecks = helpers.auditParam(checks, 'array');
            if (!err && thereAreChecks) {
                checks.forEach(check => {
                    // Read in the check data
                    _data.read('checks', check, (err, originalCheckData) => {
                        if (!err && originalCheckData) {
                            // Pass it to the check validator
                            this.validateCheckData(originalCheckData);
                        } else {
                            console.log("Error reading one of the checks' data:\n", err);
                        }
                    });
                });
            } else {
                console.log("Error: Could not find any checks to process");
            }
        });
    },

    // Sanity-check the check data
    validateCheckData(originalCheckData) {
        const { 
            id, 
            userPhone, 
            protocol, 
            url, 
            method,
            successCodes,
            timeoutSeconds,
            state,
            lastChecked
        } = originalCheckData;
        const { auditParam, auditRequiredFields, isAWholeNumber, isBetweenRange } = helpers;
        originalCheckData = (auditParam(originalCheckData, 'object')) &&
            (originalCheckData !== null) ?
                originalCheckData
            : {};
        
        // Validate check data
        const validParams = auditRequiredFields([
            { param: url },
            { param: successCodes, requiredDataType: 'array' },
            {
                param: id,
                compareOptions: {
                    requiredLength: 20,
                    operator: '=='
                }
            },
            {
                param: userPhone,
                compareOptions: {
                    requiredLength: 10,
                    operator: '=='
                }
            },
            {
                param: protocol,
                compareOptions: protocol => ['http', 'https'].includes(protocol)
            },
            {
                param: method,
                compareOptions: method => ['get', 'post', 'put', 'delete'].includes(method)
            },
            {
                param: timeoutSeconds,
                requiredDataType: 'number',
                compareOptions: timeout => isAWholeNumber(timeout) && 
                    isBetweenRange(timeout, 1, 5)
            }
        ], 7).auditPassed;

        // Initialize the keys that may not be set if the workers have never seen this check before
        originalCheckData.state = ['up', 'down'].includes(state) ? state : 'down';
        originalCheckData.lastChecked = auditParam(lastChecked, 'number') ? lastChecked : false;
        
        // If all the checks pass, pass the data along to the next step in the process
        if (validParams) {
            this.performCheck(originalCheckData);
        } else {
            console.log("Error: One of the checks is not properly formatted. Skipping it.");
        }
    },

    // Perform the check, send the originalCheckData and the outcome of the check process to the next step in the process
    performCheck(originalCheckData) {
        const { protocol, url: requestUrl, method, timeoutSeconds } = originalCheckData;
        // Prepare the initial check outcome
        const checkOutcome = {
            error: false,
            responseCode: null
        };
        // Mark that the outcome has not been sent yet
        let outcomeSent = false;
        // Parse the hostname and the path out of the original check data
        const parsedUrl = url.parse(`${protocol}://${requestUrl}`, true);
        // Using path and not "pathname" because we want the query string
        const  { hostname, path }  = parsedUrl;
        
        // Construct the request
        const requestDetails = {
            protocol: protocol+':',
            hostname,
            method: method.toUpperCase(),
            path,
            timeout: timeoutSeconds * 1000
        };

        // Instantiate the request object (using either the http or https module)
        const _moduleToUse = protocol == 'http' ? http : https;
        const req = _moduleToUse.request(requestDetails, res => {
            // Grab the status of the sent request
            const status = res.statusCode;
            // Update the check outcome and pass the data along
            checkOutcome.responseCode = status;
            if (!outcomeSent) {
                this.processCheckOutcome(originalCheckData, checkOutcome);
                outcomeSent = true;
            }
        });

        // Bind to the error event so it doesn't get thrown
        req.on('error', err => {
            // Update the checkOutcome and pass the data along
            checkOutcome.error = {
                error: true,
                value: err
            };

            if (!outcomeSent) {
                this.processCheckOutcome(originalCheckData, checkOutcome);
                outcomeSent = true;
            }
        });
        
        // Bind to the timeout event
        req.on('timeout', err => {
            // Update the checkOutcome and pass the data along
            checkOutcome.error = {
                error: true,
                value: 'timeout'
            };

            if (!outcomeSent) {
                this.processCheckOutcome(originalCheckData, checkOutcome);
                outcomeSent = true;
            }
        });

        // Send the request
        req.end();
    },

    // Process the check outcome, update the check data as needed, trigger an alert to the user if needed
    // Special logic for accomodating a check that has never been tested before (don't alert in that case)
    processCheckOutcome(originalCheckData, checkOutcome) {
        const { error, responseCode } = checkOutcome;
        const { 
            id, 
            successCodes, 
            lastChecked, 
            state: prevState 
        } = originalCheckData;

        // Decide if the check is considered up or down
        let newState  = (!error) && 
                        (responseCode) && 
                        (successCodes.includes(responseCode)) ? 'up' : 'down';
        // Decide if an alert is warranted
        const alertWarranted = (lastChecked) && (prevState !== newState);

        // Log the outcome
        const timeOfCheck = Date.now();
        this.log(originalCheckData, checkOutcome, prevState, newState, alertWarranted, timeOfCheck);

        // Update the check data
        const newCheckData = originalCheckData;
        newCheckData.state = newState;
        newCheckData.lastChecked = timeOfCheck;

        // Save the updates 
        _data.update('checks', id, newCheckData, err => {
            (!err) ?
                // Send the new check data to the next phase in the process if needed
                (alertWarranted) ?
                    this.alertUserToStatusChange(newCheckData)
                : console.log('Check outcome has not changed, no alert needed')
            : console.log('Error trying to save updates to one of the checks');
        });
    },

    // Alert the user as to a change in their check status
    alertUserToStatusChange(newCheckData) {
        const { method, protocol, url, state, userPhone } = newCheckData;
        const msg = `Alert: Your check for ${method.toUpperCase()} ${protocol}://${url} is currently ${state}`;
        helpers.sendTwilioSms(userPhone, msg, err => {
            (!err) ? 
                console.log("Success! User was alerted to a status change in their check, via sms:\n", msg) 
            : console.log("Error: Could not send sms alert to user who had a state change in their check\n", err);
        });
    }
};

module.exports = workers;