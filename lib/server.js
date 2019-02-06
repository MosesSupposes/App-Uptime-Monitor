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
            console.log(`The http server is now listening on port ${config.httpPort}`);
        }); 
        this.httpsServer.listen(config.httpsPort, () => {
            console.log(`The https server is now listening on port ${config.httpsPort}`);
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
                    console.log('Headers were likely already sent \n', e);
                }
                console.log('Returning server response:', statusCode, payloadString);
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