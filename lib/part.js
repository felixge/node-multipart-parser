var Stream = require('stream').Stream;
var util   = require('util');

module.exports = Part;
util.inherits(Part, Stream);
function Part(options) {
  Stream.call(this);

  options = options || {};

  this.headers  = options.headers || {};
  this.readable = true;
}

Part.prototype.getHeader = function(field) {
  return this.headers[field.toLowerCase()];
};

Part.prototype.getHeaderValue = function(field) {
  var value = this.getHeader(field);
  if (!value) {
    return;
  }

  var parameterStart = value.indexOf(';');
  if (parameterStart < 0) {
    return value;
  }

  return value.substr(0, parameterStart);
};

Part.prototype.write = function(buffer, start, end) {
  var slice = buffer.slice(start, end);
  this._decode(slice);
};

// @TODO Tests ...
Part.prototype._decode = function(buffer) {
  var encoding = this.getHeader('Content-Transfer-Encoding');
  var decoded = buffer;

  // @TODO there *must* be a nicer way ... o_O
  if (encoding === 'base64') {
    var str = buffer.toString('ascii');
    decoded = new Buffer(Buffer.byteLength(str, 'base64'));
    var written = decoded.write(str, 'base64');

    decoded = decoded.slice(0, written);
  }

  this.emit('data', decoded);
};

Part.prototype.end = function() {
  this.emit('end');
};
