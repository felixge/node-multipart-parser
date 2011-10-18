var _ = require('underscore');
var units = {
  'gb'    : Math.pow(1024, 3),
  'mb'    : Math.pow(1024, 2),
  'kb'    : Math.pow(1024, 1),
  'bytes' : Math.pow(1024, 0),
};

exports.toBytes = function(str) {
  var bytes = str.replace(/^([\d.]+)(.*)/i, function(m, size, unit) {
    size = parseFloat(size, 10);

    switch (unit) {
      case 'g'  :
      case 'gb' : return size * Math.pow(1024, 2);
      case 'm'  :
      case 'mb' : return size * Math.pow(1024, 2);
      case 'k'  :
      case 'kb' : return size * Math.pow(1024, 1);
      case 'b'  : return size * Math.pow(1024, 0);
      default   : throw new Error('Unknown size unit: "' + unit + '"');
    }
  });

  return parseInt(bytes, 10);
};

exports.toUnit = function(unit, bytes) {
  var limit = units[unit];
  return (bytes / limit);
};

exports.normalizeSize = function(size) {
  if (typeof size === 'string') size = this.toBytes(size);
  return this.toHuman(size);
};

exports.toHuman = function(size) {
  for (var unit in units) {
    var limit = units[unit];
    if (size < limit) continue;

    size = (size / limit)
      .toFixed(1)
      .replace(/\.0$/, '');

    return size + ' ' + unit;
  }
};

exports.boundary = function() {
  return '-----------------------------168072824752491622650073';
};

exports.multipartMessage = function(boundary, size) {
  size = this.toBytes(size);

  var head =
        '--'+boundary+'\r\n'
      + 'content-disposition: form-data; name="field1"\r\n'
      + '\r\n'
    , tail = '\r\n--'+boundary+'--\r\n'
    , buffer = new Buffer(size);

  buffer.write(head, 'ascii', 0);
  buffer.write(tail, 'ascii', buffer.length - tail.length);
  return buffer;
};
