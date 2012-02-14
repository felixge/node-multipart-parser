var Stream = require('stream').Stream;
var util   = require('util');

END_OF_FILE = {}

module.exports = Part;
util.inherits(Part, Stream);
function Part() {
  Stream.call(this);

  this.headers   = {};
  this.readable  = true;

  this._paused   = false;
  this._pendings = [];
}

Part.prototype.addHeader = function(field, value) {
  this.headers[field] = value;
};

Part.prototype.write = function(buffer, start, end) {
  var chunk = buffer.slice(start, end);

  if (this._paused || this._pendings.length) {
    this._pendings.push(chunk);
  } else {
    this.emit('data', chunk);
  }
};

Part.prototype.end = function() {
  this.readable = false;
  if (this._paused || this._pendings.length) {
    this._pendings.push(END_OF_FILE);
  } else {
    this.emit('end');
  }
};

Part.prototype.pause = function() {
  this._paused = true;
}

Part.prototype.resume = function() {
  this._paused = false;

  if (this._pendings.length) {
    var self = this;
    process.nextTick(function() {
      while (!self._paused && self._pendings.length) {
        var chunk = self._pendings.shift();
        if (chunk !== END_OF_FILE) {
          self.emit('data', chunk);
        } else {
          self.readable = false;
          self.emit('end');
        }
      }
    });
  }
}
