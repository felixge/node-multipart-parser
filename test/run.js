#!/usr/bin/env node
var fs = require('fs');
var start = +new Date;

findFiles(__dirname);

function findFiles(dir) {
  fs.readdir(dir, function(err, files) {
    if (err) throw err;

    files
      .filter(suitableFilename)
      .map(function(name) {
        return dir + '/' + name;
      })
      .forEach(stat);
  });
}

function suitableFilename(file) {
  if (/^test-.+\.js$/.test(file)) return true;
  if (!/\./.test(file)) return true;
  return false;
}

function stat(file) {
  fs.stat(file, function(err, stat) {
    if (err) throw err;

    if (stat.isDirectory()) return findFiles(file);
    run(file);
  });
}

var tests = 0;
var errors = 0;

function run(file) {
  tests++;

  try{
    require(file);
  } catch (err) {
    console.error('!', file);
    console.error(err.stack);
    console.error('');
    errors++;
  }
}

process.on('exit', function() {
  var ms = +new Date - start;
  console.error('%d test(s), %d error(s), %d ms', tests, errors, ms);
});
