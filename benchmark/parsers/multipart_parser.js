var MultipartParser = require('../../index');

module.exports = function(boundary, next) {
  var parser = MultipartParser.create(boundary);
  parser.on('end', next);
  return parser.write.bind(parser);
};
