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
        if (str) {
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
    }
};

module.exports = cli;
