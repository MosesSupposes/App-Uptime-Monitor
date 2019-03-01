/**
 * Primary file for the API
 */

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');
const cli = require('./lib/cli');
const cluster = require('cluster')
const os = require('os')

const app = {
    init(cb) {
        // If we're on the master thread, start the background workers and the CLI
        if (cluster.isMaster) {
            workers.init();
            setImmediate(() => {
                cli.init();
                cb && cb();
            });
            
            // Fork the process
            os.cpus().forEach(cpu => cluster.fork())
        } else {
            // If the current thread is a fork, start the server
            server.init();
        }
    }
};

// The app will init on its own only under the condition that it is being required directly (i.e. it's being called with the command 'node index.js' from the command line).
if (require.main === module) {
    app.init();
}

module.exports = app;

