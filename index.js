// uptime monitor app

/**
 * Primary file for the API
 */

// Dependencies
const http = require('http');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');

// The server should respond to all requests with a string
const server = http.createServer(function handleRequest(req, res) {
    
    // Get the URL and parse it
    const parsedUrl = url.parse(req.url, true);
    
    // Get the path and query string from parsed Url
    const { path, query: queryStringObject } = parsedUrl;
    // trim the path
    const trimmedPath = path.replace(/^\/+|\/+$/g,'');

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
        // Choose the handler this request should go to
        const chosenHandler = 
            typeof(router[trimmedPath]) !== 'undefined' 
                ? router[trimmedPath] 
                : handlers.notFound;

        // Construct the data object to send to the handler
        const data = {
            trimmedPath,
            queryStringObject,
            method,
            headers,
            payload: buffer
        };

        // Route the request to the handler specified in the router
        chosenHandler(data, function routeReqToHandler(statusCode=200, payload={}) {
            // Convert the paylad to a string
            const payloadString = JSON.stringify(payload);
            // Return the response
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);
            console.log('Returning this response:', statusCode, payloadString);
        });
    });
});

// Start the server and have it listen on port 3000
server.listen(config.port, () => {
    console.log(`The server is now listening on port ${config.port} in ${config.envName} mode`);
}); 

// Request handlers:
const handlers = {
    sample(data, cb) {
        // Callback an http status code and a payload object
        cb(406, {name: 'sample handler'});
    },

    notFound(data, cb) {
        cb(404);
    }
};

// Request router:
const router = {
    'sample': handlers.sample
};