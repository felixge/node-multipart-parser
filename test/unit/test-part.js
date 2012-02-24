var common = require('../common');
var test   = require('utest');
var assert = require('assert');
var Part   = require(common.dir.lib + '/part');

test('Part', {
  '#getHeader: Lowercases given field name': function() {
    var part = new Part();
    part.headers = {'content-type': 'text/plain'};

    var value = part.getHeader('Content-Type');
    assert.equal(value, 'text/plain');
  },

  '#getHeaderValue: Test normal field': function() {
    var part = new Part();
    part.headers = {'content-type': 'text/plain'};

    var value = part.getHeaderValue('content-type');
    assert.equal(value, 'text/plain');
  },

  '#getHeaderValue: Parameter field': function() {
    var part = new Part();
    part.headers = {'content-type': 'multipart/related; boundary=Apple-Mail-3-1061547936'};

    var value = part.getHeaderValue('content-type');
    assert.equal(value, 'multipart/related');
  },
});
