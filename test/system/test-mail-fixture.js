var common          = require('../common');
var fs              = require('fs');
var MultipartParser = require(common.dir.lib + '/multipart_parser');

var parser = new MultipartParser('Apple-Mail-2-1061547935');
var stream = fs.createReadStream(common.dir.fixture + '/mail.txt');

stream.pipe(parser);

parser.on('end', function() {
  console.log('parser: "end"');
});
