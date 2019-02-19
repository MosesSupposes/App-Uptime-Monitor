/**
 * CLI-Related Tasks
 */

// Dependencies
const readline = require('readline');
const helpers = require('./helpers');
const _data = require('./data');
const _logs = require('./logs');
const debug = require('util').debuglog('cli');
const events = require('events');
const os = require('os');
const v8 = require('v8');
class _events extends events{};
const e = new _events();

// Instantiate the CLI module object
const cli = {
    init() {
        // Send the start message to the console, in dark blue
        console.log('\x1b[34m%s\x1b[0m', 'The CLI is running');

        // Start the interface
        const _interface = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> '
        });

        // Create an initial prompt
        _interface.prompt();

        // Handle each line of input separately
        _interface.on('line', function handleInput(str) {
            // Send to the input processor
            this.processInput(str);

            // Re-initialize the prompt afterwards
            _interface.prompt();
        }.bind(this));

        // If the user stops the CLI, kill the associated process
        _interface.on('close', function killPrompt() {
            process.exit(0);
        });
    },

    // Input processor
    processInput(str=false) {
        const validInput = helpers.auditParam(str);
        // Only process the input if the user actually wrote something. Otherwise ignore.
        if (validInput) {
            str = str.trim().toLowerCase();
            // Codify the unique strings that identify valid commands that are provided by this module
            const uniqueInputs = [
                'man',
                'help',
                'exit',
                'stats',
                'list users',
                'more user info',
                'list checks', 
                'more check info',
                'list logs',
                'more log info'
            ];

            // Go through the possible inputs and emit an event when a match is found
            var matchFound = false;
            var counter = 0;
            uniqueInputs.some(input => {
                if (str.includes(input)) {
                    matchFound = true;
                    // Emit an event matching the unique input, and include the full string given by the user
                    e.emit(input, str);
                    return true;
                }
            });

            // If no match is found, tell the user to try again
            !matchFound && console.log('Sorry, try again');
        }
    },

    // Common formatting options for outputting text to the user
    outputs: {
        // Output a divider on the screen, similar to an HTML <hr> tag
        horizontalDivider() {
            // Get the available screen size
            const width = process.stdout.columns;
            // Add a bunch of dashes until it can't fit on the screen anymore
            var line = '';
            for (let i = 0; i < width; i++) {
                line += '-';
            }
            console.log(line);
        },

        // Output cenetered text on the screen
        centered(str='') {
            const validInput = helpers.auditParam(str);
            str = validInput ? str.trim() : '';
            
            // Get the available screen size
            const width = process.stdout.columns;
            // Calculate the necessary left padding 
            var leftPadding = Math.floor((width - str.length) / 2);

            // Insert the left padded spaces before the string itself
            var line = '';
            for (let i = 0; i < leftPadding; i++) {
                line += ' ';
            }
            // Insert the string
            line += str;
            // Whatever remaining space there is will be added as the right padding
            console.log(line);
        },

        // Output a blank empty line to the screen, similar to an HTML <br> tag
        lineBreak(numOfLines=1) {
            const validInput = helpers.auditParam(numOfLines, 'number');
            if (validInput) {
                // Output however many linebreaks were specified
                for (let i = 0; i < numOfLines; i++) {
                    console.log('');
                }
            } else {
                // Default to outputting one empty line
                console.log('');
            }

        },

        // Output a heading with as many subheadings as you like
        heading(...headers) {
            this.lineBreak();
            this.horizontalDivider();
            headers.forEach(header => {
                this.centered(header);
            });
            this.horizontalDivider();
            this.lineBreak();
        },

        // List a table of data
        table(tableInfo={}) {
            for (let key in tableInfo) {
                if (tableInfo.hasOwnProperty(key)) {
                    let value = tableInfo[key];
                    let line = `\x1b[33m${key}\x1b[0m`;
                    let padding = 60 - line.length;
                    for (let i = 0; i < padding; i++) {
                        line+= ' ';
                    }
                    line += value;
                    console.log(line);
                    this.lineBreak();
                }
            }
            this.horizontalDivider();
        }
    },

    // Responses to events
    responders: {
        help() {
            const commands = {
                'exit': 'Kill the CLI (and the rest of the application',
                'man': 'Show this help page',
                'help': 'Alias of the "man" command',
                'stats': 'Get statistics on the underlying operating system and resource utilization',
                'list users': 'Show a list of all the registered users in the system',
                'more user info --{userId}': 'Show details of a specific user',
                'list checks --up --down': 'Show a list of all the active checks in the system, including their state. The --up and --down flags are both optional', 
                'more check info --{checkId}': 'Show details of a specified check',
                'list logs': 'Show a list of all the log files available to be read (compressed only)',
                'more log info --{fileName}': 'Show details of a specified log file'
            };

            // Display a heading and a table of commands
            cli.outputs.heading('CLI Manual');
            cli.outputs.table(commands);
        },

        exit() {
            process.exit(0);
        },

        stats() {
            // Compile an object of stats
            const stats = {
                'Load Average': os.loadavg().join(' '),
                'CPU Count': os.cpus().length,
                'Free Memory': os.freemem(),
                'Current Malloced Memory': v8.getHeapStatistics().malloced_memory,
                'Peak Malloced Memory': v8.getHeapStatistics().peak_malloced_memory,
                'Allocated Heap Used (%)': Math.round((v8.getHeapStatistics().used_heap_size / v8.getHeapStatistics().total_heap_size) * 100),
                'Available Heap Allocated (%)': Math.round((v8.getHeapStatistics().total_heap_size / v8.getHeapStatistics().heap_size_limit) * 100),
                'Uptime': `${os.uptime()} seconds`
            };

            // Display a heading and a table of stats
            cli.outputs.heading('System Statistics');
            cli.outputs.table(stats);
        },

        listUsers() {
            _data.list('users', function listUsers(err, userIds) {
                if (!err && userIds && userIds.length > 0) {
                    cli.outputs.lineBreak();
                    userIds.forEach(function readFromAllUsers(userId) {
                        _data.read('users', userId, function readUserData(err, userData) {
                            if (!err && userData) {
                                var numberOfChecks = (helpers.auditParam(userData.checks, 'array')) 
                                    ? userData.checks.length
                                    : 0;
                                var line = 
                                `Name: ${userData.firstName} ${userData.lastName}
                                Phone: ${userData.phone}
                                Checks: ${numberOfChecks}`;
                                console.log(line);
                                cli.outputs.lineBreak();
                            }
                        });
                    });
                }
            });
        },

        moreUserInfo(str) {
            // Get the ID from the string 
            var flag = str.split('--')[1];
            var userId = (helpers.auditParam(flag)) ? flag.trim() : false;

            if (userId) {
                // Lookup the user
                _data.read('users', userId, function readUserData(err, userData) {
                    if (!err && userData) {
                        // Remove the hashed password
                        delete userData.hashedPassword;

                        // Print the JSON with text highlighting
                        cli.outputs.lineBreak();
                        console.dir(userData, {colors: true});
                        cli.outputs.lineBreak();
                    }
                });
            }
        },

        listChecks(str) {
            var flag = str.split('--')[1]
            var stateFlag = helpers.auditParam(flag) ? flag.trim() : false;
            str = str.toLowerCase().trim();
            _data.list('checks', function listAllChecks(err, checkIds) {
                if (!err && checkIds && checkIds.length > 0) {
                    cli.outputs.lineBreak();
                    var checksDisplayed = 0;

                    checkIds.forEach(function readAllCheckIds(checkId) {
                        _data.read('checks', checkId, function readCheckData(err, checkData) {
                            if (!err && checkData) {
                                var possibleStates = ['up', 'down'];
                                // Get the state of the check, default to down
                                var state = (typeof(checkData.state) == 'string')
                                    ? checkData.state 
                                    : 'down';
                                var stateOrUnknown = (typeof(checkData.state) == 'string')
                                    ? checkData.state 
                                    : 'unknown';
                                var output = 
                                    `ID: ${checkData.id}
                                    URL: ${checkData.method.toUpperCase()} ${checkData.protocol}://${checkData.url}
                                    State: ${stateOrUnknown}`;
                                var filterSpecified = possibleStates.includes(stateFlag);
    
                                if (!filterSpecified) {
                                    // display the check
                                    checksDisplayed++;
                                    console.log(output);
                                    cli.outputs.lineBreak();
                                } else if (filterSpecified) {
                                    // Only display the check if it matches the specified filter
                                    if (state.includes(stateFlag)) {
                                        checksDisplayed++
                                        console.log(output);
                                        cli.outputs.lineBreak();
                                    }
                                }
                            }
                        });
                    });

                    setTimeout(() => {
                        if (!checksDisplayed && flag) {
                        console.log('There are no checks with a current state of ' + flag);
                        } else if (!checksDisplayed && !flag) {
                            console.log('No users have performed any checks yet');
                        }
                    }, 100);
                }
            });
        },

        moreCheckInfo(str) {
            // Get the check ID from the string 
            var flag = str.split('--')[1];
            var checkId = (helpers.auditParam(flag)) ? flag.trim() : false;
            logs
            if (checkId) {
                // Lookup the user
                _data.read('checks', checkId, function readUserData(err, checkData) {
                    if (!err && checkData) {
                        // Print the JSON with text highlighting
                        cli.outputs.lineBreak();
                        console.dir(checkData, {colors: true});
                        cli.outputs.lineBreak();
                    }
                });
            }
        },
        
        listLogs() {
            _logs.list(true, function listAllLogs(err, logs) {
                if (!err && logs && logs.length > 0) {
                    cli.outputs.lineBreak();
                    // Filter out the non-compressed logs
                    logs.filter(log => log.includes('.gz.b64'))
                    .forEach(log => {
                        console.log(log);
                        cli.outputs.lineBreak();
                    });
                }
            });
        },

        moreLogInfo(str) {
            // Get the log file name from the string 
            var flag = str.split('--')[1];
            var logFileName = (helpers.auditParam(flag)) 
                // trim off the extra white space and file extension
                ? flag.trim().slice(0, flag.indexOf('.gz'))
                : false;
            if (logFileName) {
                cli.outputs.lineBreak();
                // Decompress the log
                _logs.decompress(logFileName, function decompressLog(err, logData) {
                    if (!err && logData) {
                        // Split into lines
                        let allLogsInThisFile = logData.split('\n');
                        allLogsInThisFile.forEach(jsonString => {
                            var logObj = helpers.parseJsonToObject(jsonString);
                            if (logObj && JSON.stringify(logObj) !== '{}') {
                                console.dir(logObj, {colors: true});
                                cli.outputs.lineBreak();
                            }
                        });
                    }
                });
            } else {
                console.log('Please specify a log');
            }
        },
    }
};


/**--------------
 * Input handlers
 ---------------*/

e.on('man', function handleManEvt(str) {
    cli.responders.help();
});

e.on('help', function handleHelpEvt(str) {
    cli.responders.help();
});

e.on('exit', function handleExitEvt(str) {
    cli.responders.exit();
});

e.on('stats', function handleStatsEvt(str) {
    cli.responders.stats();
});

e.on('list users', function handleListUsersEvt(str) {
    cli.responders.listUsers();
});

e.on('more user info', function handleMoreUserInfoEvt(str) {
    cli.responders.moreUserInfo(str);
});

e.on('list checks', function handleListChecksEvt(str) {
    cli.responders.listChecks(str);
});

e.on('more check info', function handleMoreCheckInfoEvt(str) {
    cli.responders.moreCheckInfo(str);
});

e.on('list logs', function handleListLogsEvt(str) {
    cli.responders.listLogs();
});

e.on('more log info', function handleMoreLogInfoEvt(str) {
    cli.responders.moreLogInfo(str);
});


module.exports = cli;
