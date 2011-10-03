var EventEmitter = require('events').EventEmitter;
var util = require('util');

var LF = 10;
var CR = 13;

module.exports = MultipartParser;
util.inherits(MultipartParser, EventEmitter);
function MultipartParser() {
  this.state = 'INIT';
  this.maxBoundaryBufferSize = 1024;
  this.boundary = '';
  //this.lookbehind = null;
  //this.boundaryChars = {};
}

MultipartParser.prototype.write = function(buffer) {
  for (var i = 0; i < buffer.length; i++) {
    var c = buffer[i];
    switch (this.state) {
      case 'INIT':
        this.state = 'INITIAL_BOUNDARY';
        // No break on purpose
      case 'INITIAL_BOUNDARY':
        if (c === CR) {
          if (!this.boundary) {
            this._emitError('NoInitialBoundary', c);
          } else {
            this.state = 'INITIAL_BOUNDARY_CR';
          }
        } else {
          if (this.boundary.length + 1 > this.maxBoundaryBufferSize) {
            this._emitError('MaxBufferSizeExceeded', 'Initial boundary too long');
          } else {
            this.boundary += String.fromCharCode(c);
          }
        }
        break;
      case 'INITIAL_BOUNDARY_CR':
        if (c !== LF) {
          if (this.boundary.length + 2 > this.maxBoundaryBufferSize) {
            this._emitError('MaxBufferSizeExceeded', 'Initial boundary too long');
          } else {
            this.state = 'INITIAL_BOUNDARY';
            this.boundary += '\r' + String.fromCharCode(c);
          }
        }
        break;
      default:
        break;
    }
  }
};

MultipartParser.prototype._emitError = function(type, reason) {
  this.state += '_ERROR';

  if (typeof reason === 'number') {
    var badCharacter = String.fromCharCode(reason);
    reason = 'Got byte: ' + reason + ' / "' + badCharacter + '"';
  }

  var err = new Error('MultipartParser.' + type + ': ' + reason);

  this.writable = false;
  this.emit('error', err);
};

MultipartParser.prototype.end = function() {
  this.emit('end');
};
