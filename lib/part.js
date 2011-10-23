var Stream = require('stream').Stream;
var util   = require('util');

module.exports = Part;
util.inherits(Part, Stream);
function Part() {
  Stream.call(this);

  this.headers  = {};
  this.readable = true;
}

Part.prototype.addHeader = function(field, value) {
  this.headers[field] = value;
};

Part.prototype.write = function(buffer, start, end) {
  this.emit('data', buffer.slice(start, end));
};

Part.prototype.end = function() {
  this.emit('end');
};
