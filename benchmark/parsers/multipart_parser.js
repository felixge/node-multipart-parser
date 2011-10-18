var MultipartParser = require('../index');

module.exports = function(boundary, next) {
  var parser = MultipartParser.create(boundary);
  parser.on('end', next);
  return function write(buffer) {
    parser.write(buffer);
  };
};
