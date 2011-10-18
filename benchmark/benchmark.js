#!/usr/bin/env node
var uubench = require('uubench');
var helper = require('./helper');
var options = require('commander');

options
  .option('-e, --entitysize [size]', 'The size of the entity [10mb].', '10mb')
  .option('-c, --chunksize [size]', 'The write chunksize in kb [32kb]', '32kb')
  .option('-r, --runs [runs]', 'How many times to run the benchmarks [3]', 5)
  .option('-i, --iterations [iterations]', 'The minimum amount of iterations for each run. [1]', 1)
  .parse(process.argv);

console.log('Options:');
console.log('  Entity Size : %s', helper.toHuman(options.entitysize));
console.log('  Chunk Size  : %s', helper.toHuman(options.chunksize));
console.log('  Runs        : %s', options.runs);
console.log('  Iterations  : %s', options.iterations);
console.log('');

var results = {};
var suite = new uubench.Suite({
  iterations: 1,
  result: function(name, stats) {

    var seconds = (stats.elapsed / 1000);
    var mb = helper.toUnit('mb', options.entitysize);
    var mbPerSec = (stats.iterations * mb) / seconds;

    results[name] = results[name] || [];
    results[name].push(mbPerSec);
  },
  done: function() {
    process.stdout.write('.');
    if (--options.runs) return suite.run();

    console.log('\n');

    for (var name in results) {
      var series = results[name];
      var avg    = helper.mean(series);
      var sdev   = helper.sdev(series);

      console.log('%s: %s mb/sec (+/- %s)', name, avg.toFixed(2), sdev.toFixed(2));
    }
  },
});

var boundary = helper.boundary();
var buffer = helper.multipartMessage(boundary, options.entitysize);
var chunkSize = helper.toBytes(options.chunksize);

var parsers = helper.parsers();
for (var name in parsers) {
  (function(name) {
    suite.bench(name, function(next) {
      var write = parsers[name](boundary, next);

      for (var i = 0; i < buffer.length; i += chunkSize) {
        var end = (i + chunkSize < buffer.length)
          ? i + chunkSize
          : buffer.length;

        write(buffer.slice(i, end));
      }
    });
  })(name);
}

suite.run();
