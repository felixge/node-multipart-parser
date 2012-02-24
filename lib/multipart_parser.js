var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var Part         = require('./part');

/* Tokens as defined by rfc 2616. Also lowercases them.
 *        token       = 1*<any CHAR except CTLs or separators>
 *     separators     = "(" | ")" | "<" | ">" | "@"
 *                    | "," | ";" | ":" | "\" | <">
 *                    | "/" | "[" | "]" | "?" | "="
 *                    | "{" | "}" | SP | HT
 *
 * From Ryan Dahl's http_parser.c
 */
var TOKENS = [
/*   0 nul    1 soh    2 stx    3 etx    4 eot    5 enq    6 ack    7 bel  */
        0,       0,       0,       0,       0,       0,       0,       0,
/*   8 bs     9 ht    10 nl    11 vt    12 np    13 cr    14 so    15 si   */
        0,       0,       0,       0,       0,       0,       0,       0,
/*  16 dle   17 dc1   18 dc2   19 dc3   20 dc4   21 nak   22 syn   23 etb */
        0,       0,       0,       0,       0,       0,       0,       0,
/*  24 can   25 em    26 sub   27 esc   28 fs    29 gs    30 rs    31 us  */
        0,       0,       0,       0,       0,       0,       0,       0,
/*  32 sp    33  !    34  "    35  #    36  $    37  %    38  &    39  '  */
       ' ',      '!',     '"',     '#',     '$',     '%',     '&',    '\'',
/*  40  (    41  )    42  *    43  +    44  ,    45  -    46  .    47  /  */
        0,       0,      '*',     '+',      0,      '-',     '.',     '/',
/*  48  0    49  1    50  2    51  3    52  4    53  5    54  6    55  7  */
       '0',     '1',     '2',     '3',     '4',     '5',     '6',     '7',
/*  56  8    57  9    58  :    59  ;    60  <    61  =    62  >    63  ?  */
       '8',     '9',      0,       0,       0,       0,       0,       0,
/*  64  @    65  A    66  B    67  C    68  D    69  E    70  F    71  G  */
        0,      'a',     'b',     'c',     'd',     'e',     'f',     'g',
/*  72  H    73  I    74  J    75  K    76  L    77  M    78  N    79  O  */
       'h',     'i',     'j',     'k',     'l',     'm',     'n',     'o',
/*  80  P    81  Q    82  R    83  S    84  T    85  U    86  V    87  W  */
       'p',     'q',     'r',     's',     't',     'u',     'v',     'w',
/*  88  X    89  Y    90  Z    91  [    92  \    93  ]    94  ^    95  _  */
       'x',     'y',     'z',      0,       0,       0,      '^',     '_',
/*  96  `    97  a    98  b    99  c   100  d   101  e   102  f   103  g  */
       '`',     'a',     'b',     'c',     'd',     'e',     'f',     'g',
/* 104  h   105  i   106  j   107  k   108  l   109  m   110  n   111  o  */
       'h',     'i',     'j',     'k',     'l',     'm',     'n',     'o',
/* 112  p   113  q   114  r   115  s   116  t   117  u   118  v   119  w  */
       'p',     'q',     'r',     's',     't',     'u',     'v',     'w',
/* 120  x   121  y   122  z   123  {   124  |   125  }   126  ~   127 del */
       'x',     'y',     'z',      0,      '|',     '}',     '~',       0 ];

var TAB      = 9;
var LF       = 10;
var CR       = 13;
var SPACE    = 32;
var COLON    = 58;
var DASH     = 45;
var DASH_END = new Buffer('--\r\n');

module.exports = MultipartParser;
util.inherits(MultipartParser, EventEmitter);
function MultipartParser(boundary) {
  EventEmitter.call(this);

  this.writable            = false;

  this._state              = 'NO_BOUNDARY';
  this._boundary           = null;
  this._preamble           = true;
  this._counter            = 0;
  this._marker             = 0;
  this._offset             = 0;
  this._part               = null;
  this._headerBufferLimit  = 4 * 1024;
  this._headerBufferLength = 0;
  this._headerField        = '';
  this._headerValue        = '';
  this._boundaryChars      = {};

  if (boundary) {
    this.boundary(boundary);
  }
}


MultipartParser.create = function(boundary) {
  var instance = new this();
  instance.boundary(boundary);
  return instance;
};

MultipartParser.prototype.boundary = function(boundary) {
  // Last 3 bytes are used for lookbehind
  this._boundary = new Buffer('\r\n--' + boundary + '???');
  this._state    = 'PREAMBLE';
  this.writable = true;

  this._boundaryChars = {};
  for (var i = 0; i < this._boundary.length - 3; i++) {
    this._boundaryChars[this._boundary[i]] = true;
  }
};

MultipartParser.prototype.reset = function() {
  this.constructor.call(this);
  this.removeAllListeners();
};

MultipartParser.prototype.write = function(buffer) {
  if (!this.writable) {
    throw this._error('NotWritable', 'Bad state: ' + this._state);
  }

  var i    = 0;
  var byte = buffer[i];

  while (true) {
    switch (this._state) {
      case 'PREAMBLE':
        switch (byte) {
          case CR:
            this._state   = 'BOUNDARY';
            this._marker  = 0;
            break;
          case DASH:
            // As per RFC-1341 we have to accept this, but complying clients
            // should not generate this.
            this._state  = 'BOUNDARY';
            this._marker = 2;
            break;
        }
        break;
      case 'BOUNDARY':
        if (byte !== this._boundary[++this._marker]) {
          this._state  = 'BOUNDARY_MISMATCH';
          continue;
        }

        if (this._marker === this._boundary.length - 4) {
          this._state = 'BOUNDARY_END';
        }
        break;
      case 'BOUNDARY_END':
        this._counter                  = 0;
        this._boundary[++this._marker] = byte;

        switch (byte) {
          case CR:
            this._state = 'BOUNDARY_LINE_END';
            break;
          case DASH:
            if (this._preamble) {
              this._state = 'PREAMBLE';
              break;
            }

            this._state = 'BOUNDARY_DASH_END';
            break;
          default:
            this._state = 'BOUNDARY_MISMATCH';
            continue;
        }
        break;
      case 'BOUNDARY_LINE_END':
        switch (byte) {
          case LF:
            if (this._part) this._part.end();

            this._preamble = false;
            this._state    = 'HEADER_FIELD';
            this._counter  = 0;
            this._marker   = 0;
            this._part     = new Part();
            break
          default:
            this._state = 'BOUNDARY_MISMATCH';
            continue;
        }
        break;
      case 'BOUNDARY_DASH_END':
        if (byte !== DASH_END[++this._counter]) {
          this._state = 'BOUNDARY_MISMATCH';
          continue;
        }

        if (this._counter === DASH_END.length - 1) {
          this._part.end();
          this.emit('end');
          this._state = 'EPILOGUE';
          break;
        }

        this._boundary[++this._marker] = byte;
        break;
      case 'BOUNDARY_MISMATCH':
        if (this._preamble) {
          this._state = 'PREAMBLE';
          continue;
        }

        this._part.write(this._boundary, 0, this._marker);

        this._state = 'PART_BODY';
        continue;
      case 'HEADER_FIELD':
        switch (byte) {
          case COLON:
            this._state = 'HEADER_VALUE';
            break
          case CR:
            if (this._headerField) {
              this._emitError('InvalidHeaderFieldToken', byte);
              return;
            }

            this._state = 'HEADERS_END';
            break
          default:
            var character = TOKENS[byte];
            if (!character) {
              this._emitError('InvalidHeaderFieldToken', byte);
              return;
            }

            if (++this._headerBufferLength > this._headerBufferLimit) {
              this._state = 'HEADER_BUFFER_OVERFLOW';
              continue;
            }

            this._headerField += character;
            break;
        }
        break;
      case 'HEADERS_END':
        switch (byte) {
          case LF:
            this._marker = i;
            this._state  = 'PART_BODY';
            this.emit('part', this._part);
            break;
          default:
            this._emitError('InvalidHeaderFieldToken', byte);
            return;
            break;
        }
        break;
        break;
      case 'HEADER_VALUE':
        if (byte === CR || byte === LF) {
          this._state = 'HEADER_VALUE_END';
          continue;
        }

        if (++this._headerBufferLength > this._headerBufferLimit) {
          this._state = 'HEADER_BUFFER_OVERFLOW';
          continue;
        }

        this._headerValue += String.fromCharCode(byte);
        break;
      case 'HEADER_VALUE_END':
        var valueEnd = false;

        switch (byte) {
          case CR:
            if (this._counter === 2) {
              valueEnd = true;
              break;
            }

            if (this._counter !== 0) {
              this._emitError('InvalidHeaderValueToken', byte);
              return;
            }

            this._counter++;

            break;
          case LF:
            if (this._counter !== 1) {
              this._emitError('InvalidHeaderValueToken', byte);
              return;
            }

            this._counter++;
            break;
          case TAB:
          case SPACE:
            if (this._counter !== 2) {
              this._emitError('InvalidHeaderValueToken', byte);
              return;
            }

            this._counter = 0;
            this._state   = 'HEADER_VALUE';
            continue;
          default:
            if (this._counter !== 2) {
              this._emitError('InvalidHeaderValueToken', byte);
              return;
            }

            valueEnd = true;

            break;
        }

        if (valueEnd) {
          this._part.headers[this._headerField] = this._headerValue.trim();
          this._headerField = '';
          this._headerValue = '';
          this._counter     = 0;
          this._state       = 'HEADER_FIELD';

          continue;
        }

        break;
      case 'PART_BODY':
        // There are two cases where this can happen, TODO add test
        if (byte === this._boundary[0]) {
          this._state = 'BOUNDARY';
          this._marker = 0;
          break;
        }

        this._marker = i;

        var boundaryLength = this._boundary.length - 1;
        var bufferEnd      = buffer.length;
        var boundaryChars  = this._boundaryChars;

        do {
          i += boundaryLength;
        } while (i < bufferEnd && !(buffer[i] in boundaryChars))
        i -= boundaryLength;

        this._offset += i - this._marker;
        byte = buffer[i];

        while(true) {
          if (byte === CR) {
            this._part.write(buffer, this._marker, i);
            this._marker = 0;
            this._state  = 'BOUNDARY';
            break;
          }

          this._offset++;

          if ((byte = buffer[++i]) === undefined) {
            this._part.write(buffer, this._marker, i);
            break;
          }
        }
        break;
      case 'EPILOGUE':
        return;
      case 'HEADER_BUFFER_OVERFLOW':
        this._emitError(
          'HeaderBufferOverflow',
          'Max buffer size: ' + this._headerBufferLimit + 'bytes'
        );
        return;
      case 'NO_BOUNDARY':
        this._emitError('NoBoundary', 'No boundary configured for parser.');
        return;
      default:
        this._emitError('InvalidParserState', 'Unknown state: ' + this._state);
        return;
    }

    if ((byte = buffer[++i]) === undefined) break;
    this._offset++;
  }
};

MultipartParser.prototype._error = function(type, reason) {
  if (typeof reason === 'number') {
    var byte      = reason;
    var character = String.fromCharCode(byte);

    reason =
      'Got byte: ' + byte + ' / ' + JSON.stringify(character) + ' ' +
      'at offset: ' + this._offset;
  }

  return new Error('MultipartParser.' + type + ': ' + reason);
};

MultipartParser.prototype._emitError = function(type, reason) {
  var err       = this._error(type, reason);
  this.writable = false;
  this.emit('error', err);
};

MultipartParser.prototype.end = function() {
  this.emit('end');
};
