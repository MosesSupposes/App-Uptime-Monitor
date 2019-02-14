/**
 * Frontend Logic for the application
 */

// Container for the frontend application
const app = {
    config: {
        sessionToken: false
    },

    // Init (bootstrapping)
    init() {
        // Bind all form submissions
        this.bindForms.call(this);

        // Retrieve the token from localstorage and set it in config
        this.getSessionToken.call(this);

        // Renew the token once an hour
        this.tokenRenewalLoop.call(this);
    },

    // AJAX Client (for the restful API)
    client: {
        // Interface for making api calls
        async request(headers={}, path='/', method='GET', queryStringObj={}, payload={}, cb=false) {
            // Construct the request url
            const requestUrl = `${path}`;
            var queriesAppendedToUrl = 0;
            // For each query string parameter sent, add it to the path
            for (let queryKey in queryStringObj) {
                if (queryStringObj.hasOwnProperty(queryKey)) {
                    queriesAppendedToUrl++;
                    (queriesAppendedToUrl > 1) 
                        ? requestUrl +='&'
                        : requestUrl += '?';
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

            // If there is a current session token set, add that as a header
            if (app.config.sessionToken) {
                requestOptions.headers.token = app.config.sessionToken.id;
            }

            // Send the payload as JSON
            if (Object.keys(payload).length > 0) {
                requestOptions.body = JSON.stringify(payload);
            }

            // Send the request
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
    },

    // Bind the forms
    bindForms() {
        document.querySelector('form') && 
        document.querySelector('form').addEventListener('submit', function handleFormSubmit(e) {
            // Stop it from submitting
            e.preventDefault();
            const formId = this.id;
            const path = this.action;
            const method = this.method.toUpperCase();

            // Hide the error message (if it's currently shown due to a previous error)
            document.querySelector(`#${formId} .formError`).style.display = 'hidden';

            // Turn the inputs into a payload
            const elements = Array.from(this.elements)
                .filter(element => element.type !== 'submit');
            const payload = elements.reduce((payload, element) => {
                const valueOfElement = (element.type == 'checkbox') ? 
                    element.checked 
                : element.value;
                payload[element.name] = valueOfElement;
                return payload;
            }, {});

            // Call the API
            app.client.request(undefined, path, method, undefined, payload, function handleApiResponse(statusCode, responsePayload) {
                // Display an error on the form if needed
                if (statusCode !== 200) {
                    // Try to get the error from the api, or set a default error message
                    let error = (typeof(responsePayload.Error) == 'string') ?
                        responsePayload.Error
                    : 'An error has occured, please try again';
                    // Set the formError field with the error text
                    document.querySelector(`#${formId} .formError`).innerHTML = error;

                    // Show (unhide) the form error field on the form
                    document.querySelector(`#${formId} .formError`).style.display = 'block';
                } else {
                    // If successful, send to form response processor
                    app.formResponseProcessor(formId, payload, responsePayload);
                }
            });
        });
    },

    // Form response processor
    formResponseProcessor(formId, requestPayload, responsePayload) {
        var functionToCall = false;
        // If account creation was successful, try to immediately log the user in
        if (formId == 'accountCreate') {
            // Take the phone and password, and use it to log the user in
            let newPayload = {
                'phone' : requestPayload.phone,
                'password' : requestPayload.password
            };

            this.client.request(undefined,'api/tokens','POST',undefined,newPayload, function createSessionToken(newStatusCode, newSessionToken) {
                // Display an error on the form if needed
                if(newStatusCode !== 200){
                    // Set the formError field with the error text
                    document.querySelector(`#${formId} .formError`).innerHTML = 'Sorry, an error has occured. Please try again.';

                    // Show (unhide) the form error field on the form
                    document.querySelector(`#${formId} .formError`).style.display = 'block';
                } else {
                    // If successful, set the token and redirect the user
                    this.setSessionToken(newSessionToken);
                    window.location = '/checks/all';
                }
            }.bind(this));
        }

         // If login was successful, set the token in localstorage and redirect the user
        if (formId == 'sessionCreate') {
            this.setSessionToken(responsePayload);
            window.location = '/checks/all';
        }
    },

    // Get the session token from localstorage and set it in the app.config object, then toggle CSS loggedInClass 
    getSessionToken() {
        var tokenString = localStorage.getItem('token');
        if (typeof(tokenString) == 'string') {
            try {
                let token = JSON.parse(tokenString);
                this.config.sessionToken = token;

                (typeof(token) == 'object')
                    ? this.setLoggedInClass(true)
                    : this.setLoggedInClass(false);
            } catch(e){
                this.config.sessionToken = false;
                this.setLoggedInClass(false);
            }
        }
    },

    // Toggle the 'loggedIn' class on the body
    setLoggedInClass(shouldSet) {
        var target = document.querySelector("body");
        (shouldSet) 
            ? target.classList.add('loggedIn')
            : target.classList.remove('loggedIn');
    },

    // Set the session token in the app.config object as well as localstorage
    setSessionToken(token) {
        this.config.sessionToken = token;
        var tokenString = JSON.stringify(token);
        localStorage.setItem('token', tokenString);
        (typeof(token) == 'object') 
            ? this.setLoggedInClass(true)
            : this.setLoggedInClass(false);
    },

    // Renew the session token (it expires after an hour)
    renewToken(cb) {
        var currentToken = (typeof(this.config.sessionToken)) == 'object' 
            ? this.config.sessionToken 
            : false;
        if (currentToken) {
            // Update the token with a new expiration
            let payload = {
                'id' : currentToken.id,
                'extend' : true,
            };
            this.client.request(undefined,'api/tokens','PUT',undefined,payload,function renewSessionToken(statusCode,responsePayload) {
                // Display an error on the form if needed
                if (statusCode == 200) {
                    // Get the new token details
                    let queryStringObj = {id : currentToken.id};
                    this.client.request(undefined, 'api/tokens', 'GET',queryStringObj, undefined, function getRenewedToken(statusCode, renewedToken) {
                        // Display an error on the form if needed
                        if (statusCode == 200){
                            this.setSessionToken(renewedToken);
                            cb(false);
                        } else {
                            this.setSessionToken(false);
                            cb(true);
                        }
                    }.bind(this));
                } else {
                    this.setSessionToken(false);
                    cb(true);
                }
            }.bind(this));
        } else {
            this.setSessionToken(false);
            cb(true);
        }
    },

    // Renew the session token once every 59 minutes
    tokenRenewalLoop() {
        setInterval(() => {
            this.renewToken(err => {
              !err && console.log("Token renewed successfully @ "+Date.now());
            });
          }, 1000 * 59);
    }
};

// Call the init processes after the window loads
window.onload = function onWindowLoad() {
    app.init();
};