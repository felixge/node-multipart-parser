var common          = require('../common');
var test            = common.fastOrSlow.fast();
var assert          = common.assert;
var MultipartParser = common.require('multipart_parser');
var Part            = common.require('part');
var boundary        = '------WebKitFormBoundarytyE4wkKlZ5CQJVTG';

var parser;
test.before(function() {
  parser = MultipartParser.create(boundary);
});

function assertEmitsError(buffer, expectedError) {
  var hadError = false;
  parser.on('error', function(err) {
    hadError = true;
    assert.equal(err.message.substr(0, expectedError.length), expectedError);
  });

  parser.write(buffer);
  assert.ok(hadError, 'no error was emitted');
}

test('#write: error: invalid parser state', function() {
  parser._state = 'SOMETHING';
  assertEmitsError(new Buffer('123'), 'MultipartParser.InvalidParserState');
});

test('#write: error: write without boundary', function() {
  parser._boundary = null;

  var buffer = new Buffer('a');
  assertEmitsError(buffer, 'MultipartParser.NoBoundary');
});

test('#write: leading boundary', function() {
  var buffer = new Buffer('--' + boundary + '\r\n');
  parser.write(buffer);

  assert.equal(parser._state, 'HEADER_FIELD');
});

test('#write: leading preamble', function() {
  parser.write(new Buffer(boundary.substr(0, 4) + 'HAHA'));
  assert.equal(parser._state, 'BOUNDARY_MATCH');

  parser.write(new Buffer('--' + boundary + '\r\n'));
  assert.equal(parser._state, 'HEADER_FIELD');
});

test('#write: error: Invalid header token', function() {
    // ',' is an example for an invalid token for header fields (see RFC 2616)
  var buffer = new Buffer('Invalid,Header: ');
  parser._state = 'HEADER_FIELD';
  assertEmitsError(buffer, 'MultipartParser.InvalidHeaderFieldToken');
});

test('#write: Emit part object with lowercased headers', function() {
  var buffer = new Buffer('Header-1:value-1\r\nHeader-2:value-2\r\n\r\n');
  parser._state = 'HEADER_FIELD';

  var part;
  parser.on('part', function(_part) {
    part = _part;
  });
  parser.write(buffer);


  assert.deepEqual(part.headers, {
    'header-1': 'value-1',
    'header-2': 'value-2',
  });
});

test('#write: Trim leading and trailing header value whitespace', function() {
  var buffer = new Buffer('header: value \r\n\r\n');
  parser._state = 'HEADER_FIELD';

  var part;
  parser.on('part', function(_part) {
    part = _part;
  });
  parser.write(buffer);

  assert.deepEqual(part.headers, {'header': 'value'});
});

test('#write: error: CR on non-empty _headerField', function() {
  var buffer = new Buffer('head\r');
  parser._state = 'HEADER_FIELD';
  assertEmitsError(buffer, 'MultipartParser.InvalidHeaderFieldToken');
});

test('#write: no part headers', function() {
  var buffer = new Buffer('\r\n');
  parser._state = 'HEADER_FIELD';

  var part;
  parser.on('part', function(_part) {
    part = _part;
  });
  parser.write(buffer);

  assert.deepEqual(part.headers, {});
});

test('#write: header buffer overflow in field', function() {
  parser._headerBufferLimit = 2;

  var buffer = new Buffer('ab');
  parser._state = 'HEADER_FIELD';
  parser.write(buffer);
  assertEmitsError(new Buffer('c'), 'MultipartParser.HeaderBufferOverflow');
});

test('#write: emit part data', function() {
  parser._part  = new Part();
  parser._state = 'PART_BODY';

  var expected = [
    new Buffer('abc'),
    new Buffer('def'),
  ];

  parser._part.on('data', function(buffer) {
    assert.equal(''+buffer, ''+expected.shift());
  });

  parser.write(expected[0]);
  parser.write(expected[0]);

  assert.strictEqual(expected.length, 0);
  assert.equal(parser._offset, 6);
});

test('#write: hit partial boundary in part data', function() {
  parser._part  = new Part();
  parser._state = 'PART_BODY';
  parser._boundary = new Buffer('--end');

  var buffers =[];
  parser._part.on('data', function(buffer) {
    buffers.push(''+buffer);
  });

  parser.write(new Buffer('ab--enc'));
  assert.deepEqual(buffers, ['ab', '--en', 'c']);
});

test('#write: hit partial boundary in part data spread over 2 buffers', function() {
  parser._part  = new Part();
  parser._state = 'PART_BODY';
  parser._boundary = new Buffer('--end');

  var buffers =[];
  parser._part.on('data', function(buffer) {
    buffers.push(''+buffer);
  });

  var first = new Buffer('ab--e');
  var second = new Buffer('haha');

  parser.write(first);
  assert.equal(buffers.length, 1);

  parser.write(second);
  assert.deepEqual(buffers, ['ab', '--e', 'haha']);
});

test('#write: hit partial boundary in part data spread over 3 buffers', function() {
  parser._part  = new Part();
  parser._state = 'PART_BODY';
  parser._boundary = new Buffer('--end');

  var buffers =[];
  parser._part.on('data', function(buffer) {
    buffers.push(''+buffer);
  });

  var first = new Buffer('ab--e');
  var second = new Buffer('n');
  var third = new Buffer('haha');

  parser.write(first);
  assert.equal(buffers.length, 1);

  parser.write(second);
  assert.equal(buffers.length, 1);

  parser.write(third);
  assert.deepEqual(buffers, ['ab', '--en', 'haha']);
});

test('#write: hit intermediate boundary', function() {
  parser._part  = new Part();
  parser._state = 'PART_BODY';
  parser._boundary = new Buffer('--end');

  var buffers =[];
  parser._part.on('data', function(buffer) {
    buffers.push(''+buffer);
  });

  var first = new Buffer('ab--e');
  var second = new Buffer('n');
  var third = new Buffer('haha');

  parser.write(first);
  assert.equal(buffers.length, 1);

  parser.write(second);
  assert.equal(buffers.length, 1);

  parser.write(third);
  assert.deepEqual(buffers, ['ab', '--en', 'haha']);
});

// @TODO Recognize intermediate part boundaries, emit multiple part objects
// @TODO Recognize last boundary, emit end event
// @TODO Implement benchmark (use commander for arguments)
// @TODO Implement booyer-moore speed up
