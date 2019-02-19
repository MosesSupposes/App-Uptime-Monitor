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
        this.bindForms();
        // Bind the logout button
        this.bindLogoutButton();
        // Retrieve the token from localstorage and set it in config
        this.getSessionToken();
        // Renew the token once an hour
        this.tokenRenewalLoop();
        // Load data onto page
        this.loadDataOnPage();
    },

    // AJAX Client (for the restful API)
    client: {
        // Interface for making api calls
        async request(headers={}, path='/', method='GET', queryStringObj={}, payload={}, cb=false) {
            // Construct the request url
            var requestUrl = `${path}`;
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
            if (Object.keys(payload).length > 0 && method.toUpperCase() != 'GET') {
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
        if (document.querySelector('form')) {
            const allForms = Array.from(document.querySelectorAll('form'));
            allForms.forEach(form => {
                form.addEventListener('submit', function handleFormSubmission(e) {
                    // Stop it from submitting
                    e.preventDefault();
                    const formId = this.id;
                    const path = this.action;
                    var method = this.method.toUpperCase();
                    
                    // Hide the error message (if it's currently shown due to a previous error)
                    document.querySelector(`#${formId} .formError`).style.display = 'hidden';

                    // Hide the success message (if it's currently shown due to a previous success message)
                    if (document.querySelector(`#${formId} .formSuccess`)) {
                        document.querySelector(`#${formId} .formSuccess`).style.display = 'none';
                    }
        
                    // Turn the inputs into a payload
                    const elements = Array.from(this.elements)
                        // Filter out the submit button (it's not needed for payload)
                        .filter(element => element.type !== 'submit');

                    const payload = elements.reduce((payload, element) => {
                        // Determine class of element and set value accordingly
                        const classOfElement = (typeof(element.classList.value) == 'string' && element.classList.value.length > 0) 
                            ? element.classList.value 
                            : '';
                        const valueOfElement = ((element.type == 'checkbox') &&
                        !(classOfElement.includes('multiselect')))
                            ? element.checked 
                            : !(classOfElement.includes('intval')) 
                                ? element.value 
                                : parseInt(element.value);
                        const elementIsChecked = element.checked;
                        // Override the method of the form if the input's name is _method
                        var nameOfElement = element.name;
                        if (nameOfElement == '_method') {
                            method = valueOfElement.toUpperCase();
                        } else {
                            // Create a payload field named "method" if the elements name is actually httpmethod
                            if (nameOfElement == 'httpmethod') {
                                nameOfElement = 'method';
                            }
                            // If the element has the class "multiselect" add its value(s) as array elements
                            if (classOfElement.includes('multiselect')) {
                              if (elementIsChecked) {
                                // Push any multiselect checkbox values onto an array.
                                payload[nameOfElement] = ((typeof(payload[nameOfElement]) == 'object') && (payload[nameOfElement] instanceof Array)) 
                                    ? payload[nameOfElement] 
                                    : [];
                                payload[nameOfElement].push(valueOfElement);
                                }
                            } else {
                                payload[nameOfElement] = valueOfElement;
                            }
                        }
                        
                        return payload;
                    }, {});

                    
                    // If the method is DELETE, the payload should be a queryStringObject instead
                    const queryStringObject = (method == 'DELETE') ? payload : {};

                    // Call the API
                    app.client.request(undefined, path, method, queryStringObject, payload, handleApiResponse);
                    

                    // Callback used for calling the API (see conditional logic above)
                    function handleApiResponse(statusCode, responsePayload) {
                        // Display an error on the form if needed
                        if (statusCode !== 200) {
                            if (statusCode == 403) {
                                // Log the user out
                                app.logUserOut();
                            } else {
                                // Try to get the error from the api, or set a default error message
                                let error = (typeof(responsePayload.Error) == 'string') ?
                                responsePayload.Error
                                : 'An error has occured, please try again';
                                // Set the formError field with the error text
                                document.querySelector(`#${formId} .formError`).innerHTML = error;
                                
                                // Show (unhide) the form error field on the form
                                document.querySelector(`#${formId} .formError`).style.display = 'block';
                            }
                        } else {
                            // If successful, send to form response processor
                            app.formResponseProcessor(formId, payload, responsePayload);
                        }
                    }
                });
            });
        }
    },

    // Bind the logout button
    bindLogoutButton() {
        document.getElementById('logoutButton').addEventListener('click', function handleLogout(e) {
            // Stop it from redirecting anywhere
            e.preventDefault();
            // Log the user out
            this.logUserOut();            
        }.bind(this));
    },

    // Log the user out and then redirect them
    logUserOut(redirectUser=true) {
        // Retrieve the current token id
        var tokenId = (typeof(this.config.sessionToken.id) == 'string') 
            ? this.config.sessionToken.id 
            : false;

        // Send the current token to the tokens endpoint to delete it
        var queryStringObj = {
            'id' : tokenId
        };

        this.client.request(undefined,'api/tokens', 'DELETE', queryStringObj, undefined, function deleteSessionToken(statusCode,responsePayload) {
            // Set the app.config token as false
            this.setSessionToken(false);
            // Send the user to the logged out page
            if (redirectUser) {
                window.location = '/session/deleted';
            }
        }.bind(this));
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

            this.client.request(undefined, 'api/tokens', 'POST', undefined,newPayload, function createSessionToken(newStatusCode, newSessionToken) {
                // Display an error on the form if needed
                if (newStatusCode !== 200) {
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

        // If forms saved successfully and they have success messages, show them
        var formsWithSuccessMessages = ['accountEdit1', 'accountEdit2'];
        if (formsWithSuccessMessages.includes(formId)) {
            document.querySelector(`#${formId} .formSuccess`).style.display = 'block';
        }

        // If the user just deleted their account, redirect them to the account-deleted page
        if (formId == 'accountEdit3') {
            this.logUserOut(false);
            window.location = '/account/deleted';
        }

        // If the user has just created a new check successfully, redirect back to the dashboard
        if (formId == 'checksCreate') {
            window.location = 'checks/all';
        }

        // Display success message after successfully editing a check
        if (formId == 'checksEdit1') {
            document.querySelector(`#${formId} .formSuccess`).style.display = 'block';
        }

        // If the user just deleted a check, redirect them to the dashboard
        if (formId == 'checksEdit2') {
            window.location = '/checks/all';
        }
    },

    // Retrieve the session token from localstorage and set it in the app.config object, then toggle CSS loggedInClass 
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

    // Set/remove the 'loggedIn' class on the body
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
            this.client.request(undefined, 'api/tokens', 'PUT', undefined, payload, function renewSessionToken(statusCode,responsePayload) {
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
    },

    // Load the data onto the page
    loadDataOnPage() {
        // Get the current page from the body class
        var bodyClasses = document.querySelector("body").classList;
        var primaryClass = typeof(bodyClasses[0]) == 'string' ? bodyClasses[0] : false;

        // Logic for account settings page
        if (primaryClass == 'accountEdit') {
            this.loadAccountEditPage();
        }

        // Logic for dashboard page
        if (primaryClass == 'checksList') {
            this.loadChecksListPage();
        }

        // Logic for check details page
        if (primaryClass == 'checksEdit') {
            this.loadChecksEditPage();
        }
    },

    // Load the account edit page specifically
    loadAccountEditPage() {
        // Get the phone number from the current token, or log the user out if none is there
        var phone = (typeof(this.config.sessionToken.phone) == 'string')
            ? this.config.sessionToken.phone 
            : false;
        if (phone) {
            // Fetch the user data
            const queryStringObj = { phone };
            this.client.request(undefined, 'api/users', 'GET', queryStringObj, undefined, function fetchUserData(statusCode, userData) {
                if (statusCode == 200){
                    // Put the data into the forms as values where needed
                    document.querySelector("#accountEdit1 .firstNameInput").value = userData.firstName;
                    document.querySelector("#accountEdit1 .lastNameInput").value = userData.lastName;
                    document.querySelector("#accountEdit1 .displayPhoneInput").value = userData.phone;

                    // Put the hidden phone field into both forms
                    let hiddenPhoneInputs = Array.from(document.querySelectorAll("input.hiddenPhoneNumberInput"));
                    hiddenPhoneInputs.forEach(input => input.value = userData.phone);
                } else {
                    // If the request comes back as something other than 200, log the user out (on the assumption that the api is temporarily down or the user's token is bad)
                    app.logUserOut();
                }
            });
        } else {
            app.logUserOut();
        }
    },

    // Load the dashboard page specifically
    loadChecksListPage() {
        // Get the phone number from the current token, or log the user out if none is there
        var phone = (typeof(this.config.sessionToken.phone) == 'string') 
            ? this.config.sessionToken.phone 
            : false;
        if (phone) {
            // Fetch the user data
            const queryStringObj = { phone };
            this.client.request(undefined, 'api/users', 'GET', queryStringObj, undefined, function fetchUserData(statusCode,responsePayload) {
                if (statusCode == 200) {
                    const { checks } = responsePayload;
                    // Determine how many checks the user has
                    const allChecks = ((typeof(checks) == 'object') && (checks instanceof Array) && (checks.length > 0))
                        ? checks 
                        : [];
                    if (allChecks.length > 0) {
                        // Show each created check as a new row in the table
                        allChecks.forEach(checkId => {
                            // Get the data for the check
                            var newQueryStringObj = { id : checkId };
                            app.client.request(undefined, 'api/checks', 'GET', newQueryStringObj,undefined, function fetchUserChecks(statusCode, responsePayload) {
                                if (statusCode == 200) {
                                    // Make the check data into a table row
                                    var table = document.getElementById("checksListTable");
                                    var tr = table.insertRow(-1);
                                    tr.classList.add('checkRow');
                                    var td0 = tr.insertCell(0);
                                    var td1 = tr.insertCell(1);
                                    var td2 = tr.insertCell(2);
                                    var td3 = tr.insertCell(3);
                                    var td4 = tr.insertCell(4);
                                    td0.innerHTML = responsePayload.method.toUpperCase();
                                    td1.innerHTML = responsePayload.protocol+'://';
                                    td2.innerHTML = responsePayload.url;
                                    var state = (typeof(responsePayload.state) == 'string')
                                        ? responsePayload.state 
                                        : 'unknown';
                                    td3.innerHTML = state;
                                    td4.innerHTML = `<a href="/checks/edit?id='${responsePayload.id}'">View / Edit / Delete</a>`;
                                } else {
                                    console.log("Error trying to load check ID: ", checkId);
                                }
                            });
                        });
            
                        if(allChecks.length < 5) {
                            // Show the createCheck CTA
                            document.getElementById("createCheckCTA").style.display = 'block';
                        }
            
                    } else {
                        // Show 'you have no checks' message
                        document.getElementById("noChecksMessage").style.display = 'table-row';
                        // Show the createCheck CTA
                        document.getElementById("createCheckCTA").style.display = 'block';
                    }
                } else {
                    // If the request comes back as something other than 200, log the user out (on the assumption that the api is temporarily down or the user's token is bad)
                    this.logUserOut();
                }
            }.bind(this));
        } else {
            this.logUserOut();
        }
    },

    // Load the checks edit page specifically
    loadChecksEditPage() {
        // Get the check id from the query string, if none is found then redirect back to dashboard
        console.log(id)
        var id = ((typeof(window.location.href.split('=')[1]) == 'string') && (window.location.href.split('=')[1].length > 0))
            ? window.location.href.split('=')[1] 
            : false;
        // Get rid of the cruft that comes with query strings
        id = id.replace(/%27/g, '').trim();
        if (id) {
            // Fetch the check data
            var queryStringObj = { id };
            this.client.request(undefined, 'api/checks', 'GET', queryStringObj, undefined, function fetchUserChecks(statusCode, responsePayload) {
                if (statusCode == 200) {
                    // Put the hidden id field into both forms
                    var hiddenIdInputs = Array.from(document.querySelectorAll("input.hiddenIdInput"));

                    hiddenIdInputs.forEach(input => {
                        input.value = responsePayload.id;
                    });

                    // Put the data into the top form as values where needed
                    document.querySelector("#checksEdit1 .displayIdInput").value = responsePayload.id;
                    document.querySelector("#checksEdit1 .displayStateInput").value = responsePayload.state;
                    document.querySelector("#checksEdit1 .protocolInput").value = responsePayload.protocol;
                    document.querySelector("#checksEdit1 .urlInput").value = responsePayload.url;
                    document.querySelector("#checksEdit1 .methodInput").value = responsePayload.method;
                    document.querySelector("#checksEdit1 .timeoutInput").value = responsePayload.timeoutSeconds;

                    var successCodeCheckboxes = Array.from(document.querySelectorAll("#checksEdit1 input.successCodesInput"));

                    successCodeCheckboxes.forEach(checkbox => {
                        if (responsePayload.successCodes.includes(parseInt(checkbox.value))) {
                            checkbox.checked = true;
                        }
                    });
                } else {
                    // If the request comes back as something other than 200, redirect back to dashboard
                    window.location = '/checks/all';
                }
            });
        } else {
            window.location = '/checks/all';
        }
    }
};

// Call the init processes after the window loads
window.onload = function onWindowLoad() {
    app.init();
};