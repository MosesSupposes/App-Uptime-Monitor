/**
 * Frontend Logic for the application
 */

// Container for the frontend application
 const app = {
    config: {
        sessionToken: false
    },

    // AJAX Client (for the restful API)
    client: {
        async request(headers={}, path='/', method='GET', queryStringObj={}, payload={}, cb=false) {
            // Construct the request url
            const requestUrl = `${path}`;
            var queriesAppendedToUrl = 0;
            for (let queryKey in queryStringObj) {
                if (queryStringObj.hasOwnProperty(queryKey)) {
                    queriesAppendedToUrl++;
                    if (queriesAppendedToUrl > 1) {
                        requestUrl +='&';
                    } else {
                        requstUrl += '?';
                    }
                }
                // Append the key and value
                requestUrl += `${queryKey}=${queryStringObj[queryKey]}`;
            }

            // Contruct the http request
            var requestOptions = {
                method, 
                headers: {
                    "Content-Type": "application/json",
                    ...headers
                }
            };

            if (app.config.sessionToken) {
                requestOptions.headers.token = app.config.sessionToken.id;
            }

            if (Object.keys(payload).length > 0) {
                requestOptions.body = payload;
            }

            const req = await fetch(requestUrl, requestOptions);

            // Handle the response
            const statusCode = req.status;
            const parsedResponse =  await req.json();

            // Callback if a cb was passed
            if (cb) {
                try {
                    cb(statusCode, parsedResponse);
                } catch(e) {
                    console.error(e)
                    cb(statusCode, false);
                }
            }
        }
    }
 };


