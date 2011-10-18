#!/usr/bin/env node
var helper = require('./helper');
var options = require('commander');
options
  .option('-e, --entitysize [size]', 'The size of the entity [10mb].', '10mb')
  .option('-c, --chunksize [size]', 'The write chunksize in kb [4kb]', '4kb')
  .parse(process.argv);

var boundary = helper.boundary();
var buffer = helper.multipartMessage(boundary, options.entitysize);

console.log('Options:');
console.log('  Entity Size : %s', helper.normalizeSize(options.entitysize));
console.log('  Chunk Size  : %s', helper.normalizeSize(options.chunksize));

//var suite = new uubench.Suite({
  //iterations: 3,
  //result: function(name, stats) {
    //var seconds = (stats.elapsed / 1000);
    //var mb = helper.toUnit('mb', options.entitysize);
    //var mbPerSec = (stats.iterations * mb) / seconds;

    //console.log('%s: %d mb/s', name, mbPerSec.toFixed(2));
  //},
//});



//var chunkSize = options.chunksize * 1024;
//function addParser(name) {
  //var parser = require('./' + name);
  //var buffer = createMultipartBuffer(boundary, options.entitysize * 1024 * 1024);
  //var slices = [];

  //for (var i = 0; i < buffer.length; i += chunkSize) {
    //var end = (i + chunkSize < buffer.length)
      //? i + chunkSize
      //: buffer.length;

    //slices.push(buffer.slice(i, end));
  //}

  //suite.bench(name, function(next) {
    //var write = parser(boundary, next);
    //for (var i = 0; i < slices.length; i++) {
      //var slice = slices[i];
      //write(slice);
    //}
  //});
//}

//addParser('formidable');
//addParser('multipart_parser');

//suite.run();
