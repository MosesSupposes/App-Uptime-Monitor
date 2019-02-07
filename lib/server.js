/**
 * Server-related tasks
 */

// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const fs = require('fs');
const config = require('./config');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const debug = require('util').debuglog('server');

const server = {
    // Request router:
    router: {
        ping: handlers.ping,
        users: handlers.users,
        tokens: handlers.tokens,
        checks: handlers.checks
    },

    // Start the servers
    init() {
        this.httpServer.listen(config.httpPort, () => {
            console.log('\x1b[36m%s\x1b[0m', `The http server is now listening on port ${config.httpPort}`);
        }); 
        this.httpsServer.listen(config.httpsPort, () => {
            console.log('\x1b[35m%s\x1b[0m', `The https server is now listening on port ${config.httpsPort}`);
        }); 
    },

    // All the server logic for both the http and https servers
    handleRequest(req, res) {
        // Get the URL and parse it
        const parsedUrl = url.parse(req.url, true);
        // Get the path and query string from parsed Url
        const { path, query: queryStringObject } = parsedUrl;
        // remove the slashes
        const trimmedPath = path.replace(/^\/+|\/+$/g,'');
        // remove the query string
        const trimmedPathWithouQuery = trimmedPath.replace(/\?.*$/g, '');
        // Get the HTTP method
        const method = req.method.toLowerCase();
        // Get the headers as an object
        const headers = req.headers;
        // Extract and decode the payload, if any
        const decoder = new StringDecoder('utf-8');
        var buffer = '';
        // Append the stream to the buffer
        req.on('data', function decodeAndAppendBuffer(data) {
            buffer += decoder.write(data);
        });
        // Close off the buffer and respond
        req.on('end', function endBuffer() {
            buffer += decoder.end();
            // Choose the handler server request should go to
            const chosenHandler = 
                typeof(server.router[trimmedPathWithouQuery]) !== 'undefined' 
                    ? server.router[trimmedPathWithouQuery] 
                    : handlers.notFound;
            // Construct the data object to send to the handler
            const data = {
                path: trimmedPathWithouQuery,
                queryStringObject,
                method,
                headers,
                payload: helpers.parseJsonToObject(buffer)
            };
            
            // Route the request to the handler specified in the router
            chosenHandler(data, (statusCode=200, payload={}) => {
                // Convert the paylad to a string
                const payloadString = JSON.stringify(payload);
                // Return the response
                try {
                    res.setHeader('Content-Type', 'application/json');
                    res.writeHead(statusCode);
                    res.end(payloadString);
                } catch (e) {
                    debug('Headers were likely already sent \n', e);
                }
                // Print response in green if the response is 200, otherwise print red
                (statusCode == 200) ? 
                    debug('\x1b[32m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statusCode}`)
                : debug('\x1b[31m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statusCode}`)
            });
        });
    }
};

server.httpServer = http.createServer(server.handleRequest);
server.httpsServerOptions = {
    key: fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
};
server.httpsServer = https.createServer(server.httpsServerOptions, server.handleRequest);

module.exports = server;