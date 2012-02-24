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
  this.emit('data', buffer.slice(start, end));
};

Part.prototype.end = function() {
  this.emit('end');
};
