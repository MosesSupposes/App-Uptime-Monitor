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
const { jsonHandlers, htmlHandlers } = handlers;
const helpers = require('./helpers');
const path = require('path');
const debug = require('util').debuglog('server');

const server = {
    // Route these requests to their appropriate handlers:
    router: {
        // HTML handlers
        '': htmlHandlers.index,
        'account/create': htmlHandlers.accountCreate,
        'account/edit': htmlHandlers.accountEdit,
        'account/deleted': htmlHandlers.accountDeleted,
        'session/create': htmlHandlers.sessionCreate,
        'session/deleted': htmlHandlers.sessionDeleted,
        'checks/all': htmlHandlers.checksList,
        'checks/create': htmlHandlers.checksCreate,
        'checks/edit': htmlHandlers.checksEdit,
        'favicon.ico': htmlHandlers.favicon,
        'public': htmlHandlers.public,
        // JSON handlers
        'ping': jsonHandlers.ping,
        'api/users': jsonHandlers.users,
        'api/tokens': jsonHandlers.tokens,
        'api/checks': jsonHandlers.checks
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
            let chosenHandler = 
                typeof(server.router[trimmedPathWithouQuery]) !== 'undefined' 
                    ? server.router[trimmedPathWithouQuery] 
                    : handlers.notFound;

            // If the request is within the public directory, use the public handler instead
            chosenHandler = trimmedPathWithouQuery.includes('public/') ? 
                handlers.htmlHandlers.public 
            : chosenHandler;

            // Construct the data object to send to the handler
            const data = {
                path: trimmedPathWithouQuery,
                queryStringObject,
                method,
                headers,
                payload: helpers.parseJsonToObject(buffer)
            };
            
            // Route the request to the handler specified in the router
            chosenHandler(data, (statusCode=200, payload, contentType='json') => {
                // Call at the end of the event loop to avoid bug that would send two responses occasionally instead of one
                setImmediate(() => {
                    // Return the response parts that are content-specific
                    var payloadString = ''
                    // Set the response header and default the payload param based on the specified content-type
                    if (contentType == 'json') {
                        res.setHeader('Content-Type', 'application/json');
                        payload = typeof(payload) == 'object' ? payload : {};
                        payloadString = JSON.stringify(payload);
                    }
                    if (contentType == 'html') {
                        res.setHeader('Content-Type', 'text/html');
                        payloadString = typeof(payload) == 'string' ? payload : '';
                    }
                    if (contentType == 'favicon') {
                        res.setHeader('Content-Type', 'image/x-icon');
                        payloadString = typeof(payload) !== 'undefined' ? payload : '';
                    }
                    if (contentType == 'css') {
                        res.setHeader('Content-Type', 'text/css');
                        payloadString = typeof(payload) !== 'undefined' ? payload : '';
                    }
                    if (contentType == 'png') {
                        res.setHeader('Content-Type', 'image/png');
                        payloadString = typeof(payload) !== 'undefined' ? payload : '';
                    }
                    if (contentType == 'gif') {
                        res.setHeader('Content-Type', 'image/gif');
                        payloadString = typeof(payload) !== 'undefined' ? payload : '';
                    }
                    if (contentType == 'jpg') {
                        res.setHeader('Content-Type', 'image/jpeg');
                        payloadString = typeof(payload) !== 'undefined' ? payload : '';
                    }
                    if (contentType == 'plain') {
                        res.setHeader('Content-Type', 'text/plain');
                        payloadString = typeof(payload) !== 'undefined' ? payload : '';
                    }
    
                    // Return the response parts that are content agnostic
                    res.writeHead(statusCode);
                    res.end(payloadString);
                    
                    // Print response in green if the response is 200, otherwise print red
                    (statusCode == 200) ? 
                        debug('\x1b[32m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statusCode}`)
                    : debug('\x1b[31m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statusCode}`)
                });
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