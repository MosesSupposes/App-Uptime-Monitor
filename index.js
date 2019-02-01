// uptime monitor app

/**
 * Primary file for the API
 */

// Dependencies
const http = require('http');
const url = require('url');

// The server should respond to all requests with a string
const server = http.createServer(function(req, res) {
    
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

    // Send the response
    res.end('Hello World\n');

    // Log the request path
    console.log('Request received with these headers:', headers);
});

// Start the server and have it listen on port 3000
server.listen(3000, function() {
    console.log("The server is now listening on port 3000");
}); 
