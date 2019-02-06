/**
 * Primary file for the API
 */

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

const app = {
    // Start the server and workers
    init() {
        server.init();
        // workers.init();
    }
};

app.init();

module.exports = app;

