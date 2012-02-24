var path = require('path');

var root = path.join(__dirname, '../');
exports.dir = {
  root: root,
  lib: root + '/lib',
  fixture: root + '/test/fixture',
};

exports.assert = require('assert');

exports.require = function(lib) {
  return require(exports.dir.lib + '/' + lib);
};
