var MultipartParser = require('formidable/lib/multipart_parser').MultipartParser;

module.exports = function(boundary, next) {
  var parser = new MultipartParser();
  parser.onEnd = next;
  parser.initWithBoundary(boundary);

  return parser.write.bind(parser);
};
