#!/usr/bin/env node
var util    = require('util');
var uubench = require('uubench');
var helper  = require('./helper');
var options = require('commander');

options
  .option('-e, --entitysize [size]', 'The size of the entity [10mb].', '10mb')
  .option('-c, --chunksize [size]', 'The write chunksize in kb [32kb]', '32kb')
  .option('-r, --runs [runs]', 'How many times to run the benchmarks [10]', 10)
  .option('-i, --iterations [iterations]', 'The minimum amount of iterations for each run. [10]', 10)
  .parse(process.argv);

options.runs       = parseInt(options.runs, 10);
options.iterations = parseInt(options.iterations, 10);

console.log('Options:');
console.log('  Entity Size         : %s', helper.toHuman(options.entitysize));
console.log('  Chunk Size          : %s', helper.toHuman(options.chunksize));
console.log('  Runs                : %s', options.runs);
console.log('  Iterations per run  : %s', options.iterations);
console.log('');

var start = Date.now();

var results = {};
var suite = new uubench.Suite({
  iterations: options.iterations,
  type: 'fixed',
  result: function(name, stats) {
    var seconds  = (stats.elapsed / 1000);
    var mb       = helper.toUnit('mb', options.entitysize);
    var mbPerSec = helper.round(((stats.iterations * mb) / seconds), 2);

    results[name] = results[name] || {iterations: 0, series: []};
    results[name].iterations += stats.iterations;
    results[name].series.push(mbPerSec);
  },
  done: function() {
    process.stdout.write('.');
    if (--options.runs) return suite.run();

    var duration = helper.round((Date.now() - start) / 1000, 1);
    console.log('\nBenchmark took: %d seconds\n', duration);

    for (var name in results) {
      var result = results[name];
      var series = result.series;
      series.sort(function(a, b) {
        return b - a;
      });

      var percentile = 95;
      var speed      = helper.round(helper.quantile(series, percentile / 100), 2)
      console.log(
        '%s: %s mb/sec (%d% of %d iterations)',
        name,
        speed,
        percentile,
        result.iterations
      );
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
