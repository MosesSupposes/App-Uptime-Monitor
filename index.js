// uptime monitor app

/**
 * Primary file for the API
 */

// Dependencies
const http = require('http');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;

// The server should respond to all requests with a string
const server = http.createServer(function handleRequest(req, res) {
    
    // Get the URL and parse it
    var parsedUrl = url.parse(req.url, true);
    
    // Get the path and query string from parsed Url
    var { path, query: queryStringObject } = parsedUrl;
    // trim the path
    var trimmedPath = path.replace(/^\/+|\/+$/g,'');

    // Get the HTTP method
    var method = req.method.toLowerCase();

    // Get the headers as an object
    var headers = req.headers;

    // Extract and decode the payload, if any
    var decoder = new StringDecoder('utf-8');
    var buffer = '';
    // Append the stream to the buffer
    req.on('data', function decodeAndAppendBuffer(data) {
        buffer += decoder.write(data);
    });
    // Close off the buffer and respond
    req.on('end', function endBuffer() {
        buffer += decoder.end();
        res.end('Hello World\n');
        console.log('Request received with this payload:', buffer);
    });
});

// Start the server and have it listen on port 3000
server.listen(3000, function() {
    console.log("The server is now listening on port 3000");
}); 
