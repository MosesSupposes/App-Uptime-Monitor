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
    },

    // AJAX Client (for the restful API)
    client: {
        // Interface for making api calls
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
                requestOptions.body = JSON.stringify(payload);
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
    },

    // Bind the forms
    bindForms() {
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

            // // Call the API
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
        if (formId == 'accountCreate') {
            console.log('The accountCreate form was successfully submitted');
            // @TODO Do something here now that the account has been created successfully
        }
    }
};

// Call the init processes after the window loads
window.onload = function onWindowLoad() {
    app.init();
};