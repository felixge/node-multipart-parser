var common = require('../common');
var test = common.fastOrSlow.fast();
var assert = common.assert;

var MultipartParser = common.require('multipart_parser');

var parser;
test.before(function() {
  parser = new MultipartParser();
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

test('#write: capture boundary from first line', function() {
  var boundary = '------WebKitFormBoundarytyE4wkKlZ5CQJVTG';
  var buffer = new Buffer(boundary + '\r\n', 'ascii');
  parser.write(buffer);

  assert.equal(parser.boundary, boundary);
});

test('#write: error: no boundary', function() {
  var buffer = new Buffer('\r', 'ascii');
  assertEmitsError(buffer, 'MultipartParser.NoInitialBoundary');
});

test('#write: forgive: CR character in boundary', function() {
  var boundary = 'ab\rc';
  var buffer = new Buffer(boundary + '\r\n', 'ascii');
  parser.write(buffer);

  assert.equal(parser.boundary, boundary);
});

test('#write: error: initial boundary exceeds 1024 bytes', function() {
  var boundary = '';
  for (var i = 0; i < 1025; i++) {
    boundary += '-';
  }

  var buffer = new Buffer(boundary + '\r\n', 'ascii');
  assertEmitsError(buffer, 'MultipartParser.MaxBufferSizeExceeded');
});
