/**
 * CLI-Related Tasks
 */

// Dependencies
const readline = require('readline');
const helpers = require('./helpers');
const debug = require('util').debuglog('cli');
const events = require('events');
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

        // Output a blank empty line to the screen
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
                'list logs': 'Show a list of all the log files available to be read (compressed and uncompressed)',
                'more log info --{fileName}': 'Show details of a specified log file'
            };

            // Show a horizontalDivider for the help page that is as wide as the screen
            cli.outputs.horizontalDivider();
            cli.outputs.centered('CLI MANUAL');
            cli.outputs.horizontalDivider();
            cli.outputs.lineBreak(2);

            // Show each command , followed by its explanation, in white and yellow respectively
            for (let key in commands) {
                if (commands.hasOwnProperty(key)) {
                    let value = commands[key];
                    let line = `\x1b[33m${key}\x1b[0m`;
                    let padding = 60 - line.length;
                    for (let i = 0; i < padding; i++) {
                        line+= ' ';
                    }
                    line += value;
                    console.log(line);
                    cli.outputs.lineBreak();
                }
            }
            cli.outputs.lineBreak();
            cli.outputs.horizontalDivider();
        },

        exit() {
            process.exit(0);
        },

        stats() {
            console.log('You asked for stats');
        },

        listUsers() {
            console.log('You asked to list users');
        },

        moreUserInfo(str) {
            console.log('You asked for more user info', str);
        },

        listChecks(str) {
            console.log('You asked to list checks', str);
        },

        moreCheckInfo(str) {
            console.log('You asked for more check info', str);
        },
        
        listLogs() {
            console.log('You asked to list logs');
        },

        moreLogInfo(str) {
            console.log('You asked for more log info', str);
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
