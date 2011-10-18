var _     = require('underscore');
var fs    = require('fs');
var units = {
  'gb'    : Math.pow(1024, 3),
  'mb'    : Math.pow(1024, 2),
  'kb'    : Math.pow(1024, 1),
  'bytes' : Math.pow(1024, 0),
};

exports.toBytes = function(str) {
  if (typeof str === 'number') return str;

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

exports.toUnit = function(unit, size) {
  var bytes = this.toBytes(size);
  var limit = units[unit];

  return (bytes / limit);
};

exports.toHuman = function(size) {
  size = (typeof size === 'string')
    ? size = this.toBytes(size)
    : size;

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

exports.parsers = function() {
  var dir     = __dirname + '/parsers';
  var parsers = {};

  fs
    .readdirSync(dir)
    .filter(function(name) {
      return /\.js$/.test(name);
    })
    .forEach(function(file) {
      var parser = require(dir + '/' + file);
      var name = file.replace(/\.js$/, '');

      parsers[name] = parser;
    });

  return parsers;
};

// From: https://gist.github.com/642690
(function(uustats){
  uustats.sdev = function(series) {
    return Math.sqrt(uustats.variance(series));
  };

  uustats.variance = function(series) {
    var t = 0, squares = 0, len = series.length;

    for (var i=0; i<len; i++) {
      var obs = series[i];
      t += obs;
      squares += Math.pow(obs, 2);
    }
    return (squares/len) - Math.pow(t/len, 2);
  },

  uustats.mean = function(series) {
    var t = 0, len = series.length;

    for (var i=0; i<len; i++) {
      t += series[i];
    }
    return t / Math.max(len, 1);
  }

  uustats.summary = function(series) {
    var q = uustats.quantile,
        a = series.slice(0).sort(function(a, b) { return a - b });

    return {
      min: a[0],
      p25: q(a, 0.25),
      med: q(a, 0.5),
      p75: q(a, 0.75),
      max: a[a.length - 1],
      p10: q(a, 0.1),
      p90: q(a, 0.9),
      avg: uustats.mean(a)
    }
  };

  uustats.quantile = function(series, q) {
    var len = series.length,
        pos = q * (len - 1),
        t   = Math.ceil(pos),
        f   = t - 1;

    if (f < 0) { return series[0] }
    if (t >= len) { return series[len - 1] }
    return series[f] * (t - pos) + series[t] * (pos - f);
  };

  uustats.round = function(x, n) {
    return Math.round(x*Math.pow(10, n))/Math.pow(10, n);
  };
})(typeof exports !== 'undefined' ? exports : window.uustats = {});
