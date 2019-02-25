/**
 * Primary file for the API
 */

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');
const cli = require('./lib/cli');

const app = {
    init(cb) {
        // Start the server
        server.init();
        // Start the workers
        workers.init();
        // Start the CLI, but make sure it starts last
        setImmediate(() => {
            cli.init();
            // Finally, callback
            cb && cb();
        });
    }
};

// The app will init on its own only under the condition that it is being required directly (i.e. it's being called with the command 'node index.js' from the command line).
if (require.main === module) {
    app.init();
}

module.exports = app;

