/**
 * Primary file for the API
 */

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');
const cli = require('./lib/cli');

const app = {
    init() {
        // Start the server
        server.init();
        // Start the workers
        workers.init();
        // Start the CLI, but make sure it starts last
        setImmediate(() => cli.init());
    }
};

app.init();

module.exports = app;

