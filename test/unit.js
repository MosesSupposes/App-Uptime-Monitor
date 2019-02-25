/**
 * Unit Tests
 */

// Dependencies
const assert = require('assert');
const logs = require('../lib/logs');

// Container for all the tests
const unit = {};

//#region example unit tests
const sampleUnitTests = { 
    getANumber() { return 1 }
};
// Assert that the getANumber function is returning a number
unit['sampleUnitTests.getANumber should return a number'] = done => {
    var val = sampleUnitTests.getANumber();
    assert.equal(typeof(val), 'number');
    done();
};

// Assert that the getANumber function is returning a 1
unit['sampleUnitTests.getANumber should return 1'] = done => {
    var val = sampleUnitTests.getANumber();
    assert.equal(val, 1);
    done();
};

// Assert that the getANumber function is returning a 2
unit['sampleUnitTests.getANumber should return 2'] = done => {
    var val = sampleUnitTests.getANumber();
    assert.equal(val, 2);
    done();
};
//#endregion

//#region logs library unit tests
    unit['Logs.list should callback a false error and an array of log names.'] = done => {
        logs.list(true, (err, logFileNames) => {
            assert.equal(err, null);
            assert.ok(logFileNames instanceof Array);
            assert.ok(logFileNames.length > 1);
            done();
        });
    };

    unit['Logs.truncate should not throw if the logId doesn\'t exist. It should callback an error instead.'] = done => {
        assert.doesNotThrow(() => {
            logs.truncate('I do not exist', err => {
                assert.ok(err);
                done();
            });
        }, TypeError);
    };
//#endregion
module.exports = unit;