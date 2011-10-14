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

var LF    = 10;
var CR    = 13;
var COLON = 58;
var CRLF  = [CR, LF];

module.exports = MultipartParser;
util.inherits(MultipartParser, EventEmitter);
function MultipartParser() {
  EventEmitter.call(this);

  this._state              = 'INIT';
  this._boundary           = null;
  this._lookbehind         = null;
  this._counter            = 0;
  this._start              = 0;
  this._offset             = 0;
  this._headerBufferLimit  = 4 * 1024;
  this._headerBufferLength = 0;
  this._headerField        = '';
  this._headerValue        = '';
  this._headers            = {};
  this._part               = null;
}


MultipartParser.create = function(boundary) {
  var instance = new this();
  instance.boundary(boundary);
  return instance;
};

MultipartParser.prototype.boundary = function(boundary) {
  this._boundary   = new Buffer('\r\n--' + boundary + '--\r\n');
  this._lookbehind = new Buffer(this._boundary.length);
};


MultipartParser.prototype.write = function(buffer) {
  if (!this._boundary) {
    this._emitError('NoBoundary', 'No boundary configured for parser.');
    return;
  }

  this._start = 0;

  for (var i = 0; i < buffer.length; i++) {
    var byte = buffer[i];
    this._offset++;

    switch (this._state) {
      case 'INIT':
        // First boundary has no leading \r\n
        this._counter = 2;
        this._state = 'BOUNDARY_MATCH';
        // no break;
      case 'BOUNDARY_MATCH':
        if (byte !== this._boundary[this._counter]) {
          this._counter = 2;
          break;
        }

        // Only the last boundary has a trailing '--', skip it here
        this._counter += (this._counter === this._boundary.length - 5)
          ? 3
          : 1;

        if (this._counter === this._boundary.length) {
          this._counter = 0;
          this._state   = 'HEADER_FIELD';
        }
        break;
      case 'HEADER_FIELD':
        if (byte === COLON) {
          this._state = 'HEADER_VALUE';
          break;
        }

        if (!this._headerField && byte === CRLF[this._counter]) {
          this._counter++;
          if (this._counter === CRLF.length) {
            this._counter            = 0;
            this._part               = new Part(this._headers);
            this._state              = 'PART_BODY';
            this._headers            = {};
            this.emit('part', this._part);
          }
          break;
        } else {
          this._counter = 0;
        }

        var character = TOKENS[byte];
        if (!character) {
          this._emitError('InvalidHeaderFieldToken', byte);
          return;
        }

        this._headerBufferLength++;
        if (this._bufferOverflow()) return;

        this._headerField += character;
        break;
      case 'HEADER_VALUE':
        if (byte === CRLF[this._counter]) {
          this._counter++;
          if (this._counter === CRLF.length) {
            this._headers[this._headerField] = this._headerValue.trim();
            this._headerField                = '';
            this._headerValue                = '';
            this._counter                    = 0;
            this._start                      = i + 1;
            this._state                      = 'HEADER_FIELD';
          }
          break;
        } else {
          this._counter = 0;
        }

        this._headerBufferLength++;
        if (this._bufferOverflow()) return;

        this._headerValue += String.fromCharCode(byte);
        break;
      case 'PART_BODY':
        if (byte === this._boundary[this._counter]) {
          if (this._counter === 0) {
            this._part.emit('data', buffer.slice(this._start, i));
          }

          this._lookbehind[this._counter] = byte;
          this._counter++;
          break;
        } else if (this._counter > 0) {
          this._part.emit('data', this._lookbehind.slice(0, this._counter));
          this._start   = i;
          this._counter = 0;
        }

        if (i === buffer.length - 1) {
          this._part.emit('data', buffer.slice(this._start, i + 1));
          this._start = 0;
          break;
        }
        break;
      default:
        this._emitError('InvalidParserState', 'Unknown state: ' + this._state);
        return;
    }
  }
};

MultipartParser.prototype._bufferOverflow = function() {
  if (this._headerBufferLength <= this._headerBufferLimit) return false;

  this._emitError(
    'HeaderBufferOverflow',
    'Max buffer size: ' + this._headerBufferLimit + 'bytes'
  );
  return true;
};

MultipartParser.prototype._emitError = function(type, reason) {
  this.state += '_ERROR';

  if (typeof reason === 'number') {
    var byte      = reason;
    var character = String.fromCharCode(byte);

    reason =
      'Got byte: ' + byte + ' / ' + JSON.stringify(character) + ' ' +
      'at offset: ' + this._offset;
  }

  var err       = new Error('MultipartParser.' + type + ': ' + reason);
  this.writable = false;

  this.emit('error', err);
};

MultipartParser.prototype.end = function() {
  this.emit('end');
};
