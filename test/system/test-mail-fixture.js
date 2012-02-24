var common          = require('../common');
var assert          = require('assert');
var fs              = require('fs');
var MultipartParser = require(common.dir.lib + '/multipart_parser');

var parser = new MultipartParser('Apple-Mail-2-1061547935');
var stream = fs.createReadStream(common.dir.fixture + '/mail.txt');

stream.pipe(parser);

var partEvents = 0;
var endEvents  = 0;

parser
  .on('part', function(part) {
    partEvents++;

    var contentType = part.headers['content-type'];
    var match       = contentType.match(/boundary=([^; ]+)/)

    if (!match) {
      return;
    }

    var subParser = new MultipartParser(match[1]);
    part.pipe(subParser);
  })
  .on('end', function() {
    endEvents++;
  });

process.on('exit', function() {
  assert.equal(partEvents, 2);
  assert.equal(endEvents, 1);
});
