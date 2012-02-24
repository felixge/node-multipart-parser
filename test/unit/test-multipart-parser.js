var common          = require('../common');
var test            = require('utest');
var assert          = common.assert;
var MultipartParser = common.require('multipart_parser');
var Part            = common.require('part');
var boundary        = '------WebKitFormBoundarytyE4wkKlZ5CQJVTG';

var parser;
test('MultipartParser', {
  before: function() {
    parser = MultipartParser.create(boundary);
  },

  '#write: error: invalid parser state': function() {
    parser._state = 'SOMETHING';
    assertEmitsError(new Buffer('123'), 'MultipartParser.InvalidParserState');
  },

  '#write: error: write without boundary': function() {
    var buffer = new Buffer('a');
    parser     = new MultipartParser();

    assert.throws(function() {
      parser.write(buffer);
    }, /Bad state: NO_BOUNDARY/);
  },

  '#write: tolerate missing CRLF on first boundary': function() {
    var buffer = new Buffer('--' + boundary + '\r\n');
    parser.write(buffer);

    assert.equal(parser._state, 'HEADER_FIELD');
  },

  '#write: leading preamble': function() {
    parser.write(new Buffer(boundary.substr(0, 4) + 'HAHA'));
    assert.equal(parser._state, 'PREAMBLE');

    parser.write(new Buffer('--' + boundary + '\r\n'));
    assert.equal(parser._state, 'HEADER_FIELD');
  },

  '#write: error: Invalid header token': function() {
      // ',' is an example for an invalid token for header fields (see RFC 2616)
    var buffer = new Buffer('Invalid,Header: ');
    parser._state = 'HEADER_FIELD';
    assertEmitsError(buffer, 'MultipartParser.InvalidHeaderFieldToken');
  },

  '#write: Emit part object with lowercased headers': function() {
    var buffer = new Buffer('Header-1:value-1\r\nHeader-2:value-2\r\n\r\n');
    parser._state = 'HEADER_FIELD';
    parser._part  = new Part();

    parser.write(buffer);

    assert.deepEqual(parser._part.headers, {
      'header-1': 'value-1',
      'header-2': 'value-2',
    });
  },

  '#write: Trim leading and trailing header value whitespace': function() {
    var buffer = new Buffer('header: value \r\n\r\n');
    parser._state = 'HEADER_FIELD';
    parser._part  = new Part();

    parser.write(buffer);

    assert.deepEqual(parser._part.headers, {'header': 'value'});
  },

  // See: http://tools.ietf.org/html/rfc822#section-3.1.3
  '#write: Handle multi-line header field value (email)': function() {
    var buffer = new Buffer(
      'Content-Type: text/html;\r\n' +
      '\tcharset="ISO-8859-4"\r\n' +
      'Content-Transfer-Encoding: quoted-printable\r\n\r\n'
    );

    parser._state = 'HEADER_FIELD';
    parser._part  = new Part();

    parser.write(buffer);

    assert.deepEqual(parser._part.headers, {
      'content-type': 'text/html;\tcharset="ISO-8859-4"',
      'content-transfer-encoding': 'quoted-printable',
    });
  },

  '#write: error: CR on non-empty _headerField': function() {
    var buffer = new Buffer('head\r');
    parser._state = 'HEADER_FIELD';
    assertEmitsError(buffer, 'MultipartParser.InvalidHeaderFieldToken');
  },

  '#write: no part headers': function() {
    var buffer = new Buffer('\r\n');
    parser._state = 'HEADER_FIELD';
    parser._part  = new Part();

    parser.write(buffer);

    assert.deepEqual(parser._part.headers, {});
  },

  '#write: header buffer overflow in field': function() {
    parser._headerBufferLimit = 2;

    var buffer = new Buffer('ab');
    parser._state = 'HEADER_FIELD';
    parser.write(buffer);
    assertEmitsError(new Buffer('c'), 'MultipartParser.HeaderBufferOverflow');
  },

  '#write: emit part data': function() {
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
  },

  '#write: hit partial boundary in part data': function() {
    parser.boundary('end');
    parser._preamble = false;
    parser._part     = new Part();
    parser._state    = 'PART_BODY';

    var buffers =[];
    parser._part.on('data', function(buffer) {
      buffers.push(''+buffer);
    });

    parser.write(new Buffer('ab\r\n--enc'));
    assert.deepEqual(buffers, ['ab', '\r\n--en', 'c']);
  },

  '#write: hit partial boundary in part data spread over 2 buffers': function() {
    parser.boundary('end');
    parser._preamble = false;
    parser._part     = new Part();
    parser._state    = 'PART_BODY';

    var buffers =[];
    parser._part.on('data', function(buffer) {
      buffers.push(''+buffer);
    });

    var first = new Buffer('ab\r\n--e');
    var second = new Buffer('haha');

    parser.write(first);
    assert.equal(buffers.length, 1);

    parser.write(second);
    assert.deepEqual(buffers, ['ab', '\r\n--e', 'haha']);
  },

  '#write: hit partial boundary in part data spread over 3 buffers': function() {
    parser.boundary('end');
    parser._preamble = false;
    parser._part     = new Part();
    parser._state    = 'PART_BODY';

    var buffers =[];
    parser._part.on('data', function(buffer) {
      buffers.push(''+buffer);
    });

    var first = new Buffer('ab\r\n--e');
    var second = new Buffer('n');
    var third = new Buffer('haha');

    parser.write(first);
    assert.equal(buffers.length, 1);

    parser.write(second);
    assert.equal(buffers.length, 1);

    parser.write(third);
    assert.deepEqual(buffers, ['ab', '\r\n--en', 'haha']);
  },

  '#write: full rfc1341 entity': function() {
    testRfc1341Entity();
  },

  '#write: full rfc1341 entity with chunk size 1-10': function() {
    // What can I say, my ability to visualize this state machine has its limits :)
    for (var i = 1; i <= 10; i++) {
      try {
        testRfc1341Entity(i);
      } catch (err) {
        err.message = 'Chunk size: ' + i + ': ' + err;
        throw err;
      }
    }
  }
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

function testRfc1341Entity(chunkSize) {
  parser.boundary('simple boundary');

  var part1 =
    'This is implicitly typed plain ASCII text.\r\n' +
    'It does NOT end with a linebreak.';
  var part2 =
    'This is explicitly typed plain ASCII text.\r\n' +
    'It DOES end with a linebreak.\r\n';

  var rfc1341Entity =
    'This is the preamble.  It is to be ignored, though it\r\n' +
    'is a handy place for mail composers to include an\r\n' +
    'explanatory note to non-MIME compliant readers.\r\n' +
    '--simple boundary\r\n' +
    '\r\n' +
    part1 +
    '\r\n' +
    '--simple boundary\r\n' +
    'Content-type: text/plain; charset=us-ascii\r\n' +
    '\r\n' +
    part2 +
    '\r\n' +
    '--simple boundary--\r\n' +
    'This is the epilogue.  It is also to be ignored.\r\n';

  var parts = [];
  var ended = false;
  parser
    .on('error', function(error) {
      throw error;
    })
    .on('part', function(part) {
      parts.push(part);

      part.data = '';
      part
        .on('data', function(chunk) {
          part.data += chunk;
        })
        .on('end', function() {
          part.ended = true;
        });
    })
    .on('end', function() {
      ended = true;
    });

  var buffer = new Buffer(rfc1341Entity);
  if (!chunkSize) {
    parser.write(buffer);
  } else {
    for (var i = 0; i < buffer.length; i += chunkSize) {
      var end = (i + chunkSize < buffer.length)
        ? i + chunkSize
        : buffer.length;

      var chunk = new Buffer(buffer.slice(i, end));
      parser.write(chunk);
    }
  }

  assert.equal(parts.length, 2);
  assert.equal(parts[0].data, part1);
  assert.equal(parts[1].data, part2);
  parts.forEach(function(part, i) {
    assert.ok(part.ended, 'Part ' + (i + 1) + ' did not end.');
  });
  assert.ok(ended);

  // Reset the parser so it can be re-used
  parser.reset();
}
