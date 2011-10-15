#!/usr/bin/env node
var options = require('commander');
var uubench = require('uubench');
options
  .option('-e, --entitysize [mb]', 'The size of the entity in mb [10].', 10)
  .option('-c, --chunksize [kb]', 'The write chunksize in kb [4]', 4)
  .parse(process.argv);

function createMultipartBuffer(boundary, size) {
  var head =
        '--'+boundary+'\r\n'
      + 'content-disposition: form-data; name="field1"\r\n'
      + '\r\n'
    , tail = '\r\n--'+boundary+'--\r\n'
    , buffer = new Buffer(size);

  buffer.write(head, 'ascii', 0);
  buffer.write(tail, 'ascii', buffer.length - tail.length);
  return buffer;
}

var boundary = '-----------------------------168072824752491622650073';
var buffer = createMultipartBuffer(boundary, options.megabytes * 1024 * 1024);

var suite = new uubench.Suite({
  iterations: 3,
  result: function(name, stats) {
    var seconds = (stats.elapsed / 1000);
    var mbytesPerSec = (stats.iterations * options.entitysize) / seconds;

    console.log('%s: %d MBytes/s', name, mbytesPerSec.toFixed(2));
  },
});

var chunkSize = options.chunksize * 1024;
function addParser(name) {
  var parser = require('./' + name);
  var buffer = createMultipartBuffer(boundary, options.entitysize * 1024 * 1024);
  var slices = [];

  for (var i = 0; i < buffer.length; i += chunkSize) {
    var end = (i + chunkSize < buffer.length)
      ? i + chunkSize
      : buffer.length;

    slices.push(buffer.slice(i, end));
  }

  suite.bench(name, function(next) {
    var write = parser(boundary, next);
    for (var i = 0; i < slices.length; i++) {
      var slice = slices[i];
      write(slice);
    }
  });
}

addParser('formidable');
addParser('multipart_parser');

suite.run();
