/**
 * API Tests
 */

// Dependencies
const app = require('../index');
const assert = require('assert');
const helpers = require('../lib/helpers');

// Container for the tests
const api = {};

// The main init() function should be able to run without throwing
api['app.init should start without throwing.'] = done => {
    assert.doesNotThrow(() => {
        app.init(err => done());
    }, TypeError);
};

api['/ping should respond to GET with 200.'] = done => {
    helpers.craftGetRequest('/ping', res => {
        assert.equal(res.statusCode, 200);
        done();
    });
};

api['/api/users should respond to GET with 400.'] = done => {
    helpers.craftGetRequest('/api/users', res => {
        assert.equal(res.statusCode, 400);
        done();
    });
};

api['A random path should respond to GET with 404.'] = done => {
    helpers.craftGetRequest('/this/path/shouldnt/exist', res => {
        assert.equal(res.statusCode, 404);
        done();
    });
};

module.exports = api;