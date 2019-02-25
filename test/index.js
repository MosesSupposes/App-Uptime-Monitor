/**
 * Test Runner
 */

// Dependencies
const { outputs: clFormats } = require('../lib/cli');

// Application logic for the test runner
const _app = {
    // Run all the tests, collecting the errors and successors
    runTests() {
        const limit = this.countTests();
        const errors = [];
        var successes = 0;
        var counter = 0;

        for (let testType in this.tests) {
            if (this.tests.hasOwnProperty(testType)) {
                let subTests = this.tests[testType]
                for (let testName in subTests) {
                    if (subTests.hasOwnProperty(testName)) {
                        (() => {
                            var tmpTestName = testName;
                            var testValue = subTests[testName]
                            // Call the test
                            try {
                                testValue(function done() {
                                    // If it calls back without throwing, then it succeeded, so log it in green
                                    console.log('\x1b[32m%s\x1b[0m', tmpTestName);
                                    counter++;
                                    successes++;
                                    if (counter == limit) {
                                        this.produceTestReport(limit, successes, errors);
                                    }
                                }.bind(this));
                            } catch(e) {
                                // If it throws, then it failed, so capture the error thrown and log it in red
                                errors.push({
                                    name: testName,
                                    value: e
                                });
                                console.log('\x1b[31m%s\x1b[0m', tmpTestName);
                                counter++;
                                if (counter == limit) {
                                    this.produceTestReport(limit, successes, errors);
                                }
                            }
                        })();
                    }
                }
            }
        }
    },

    // Count all the tests
    countTests() {
        var counter = 0;
        for (let testType in this.tests) {
            if (this.tests.hasOwnProperty(testType)) {
                let subTests = this.tests[testType];
                for (let testName in subTests) {
                    if (subTests.hasOwnProperty(testName)) {
                        counter++;
                    }
                }
            }
        }
        return counter;
    },

    // Produce a test outcome report
    produceTestReport(limit, successes, errors) {
        clFormats.heading('BEGIN TEST REPORT');
        clFormats.table(
            { 
                'Total Tests': limit, 
                'Passed': successes,
                'Failed': errors.length
            }
        );

        // If there are errors, print them in detail
        if (errors.length > 0) {
            clFormats.heading('BEGIN ERROR DETAILS');
            const errorTable = errors.reduce((errTable, err) => {
                errTable[err.name] = err.value;
                return errTable;
            }, {});
            clFormats.table(errorTable);
            clFormats.heading('END ERROR DETAILS');
        }

        clFormats.heading('END TEST REPORT');
    }
};

// Container for the tests
_app.tests = {
    unit: require('./unit')
};

// Run the tests
_app.runTests();