var Stream = require('stream').Stream;
var util   = require('util');

module.exports = Part;
util.inherits(Part, Stream);
function Part(headers) {
  Stream.call(this);

  this.headers  = headers;
  this.readable = true;
}
