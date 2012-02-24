return console.log('disabled');

var common = require('../common');
var assert = common.assert;
var fs = require('fs');
var path = require('path');
var MultipartParser = common.require('multipart_parser');

findFixtures(common.dir.fixture + '/js');

function findFixtures(dir) {
  fs.readdir(dir, function(err, files) {
    if (err) throw err;
    files
      .map(function(file) {
        return dir + '/' + file;
      })
      .forEach(load);
  });
}


function load(jsFixture) {
  if (!/\.js$/.test(jsFixture)) return;

  var tests = require(jsFixture);
  var dir = common.dir.fixture + '/http/' + path.basename(jsFixture, '.js');

  for (var name in tests) {
    var httpFixture = fs.createReadStream(dir + '/' + name);
    verify(httpFixture, tests[name]);
  }
}

function verify(http, expected) {
  var ended = false;
  var parser = new MultipartParser();
  var parts = [];
  var shortPath = http.path.substr(common.dir.fixture.length + '/http/'.length);

  http.pipe(parser);

  parser
    .on('part', function(part) {
      parts.push(part);
    })
    .on('end', function() {
      ended = true;

      assert.equal(
        parts.length,
        expected.length,
        'Expected ' + expected.length + ' part(s), got: ' + parts.length + ': ' +
        shortPath
      );
    });

  http
    .on('end', function() {
      assert.ok(ended, 'Parser did not end: ' + shortPath);
    });
}
