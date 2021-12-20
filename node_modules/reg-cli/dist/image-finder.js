'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findImages = undefined;

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var difference = function difference(arrA, arrB) {
  return arrA.filter(function (a) {
    return !arrB.includes(a);
  });
}; // $FlowIgnore


var IMAGE_FILES = '/**/*.+(tiff|jpeg|jpg|gif|png|bmp)';

var findImages = exports.findImages = function findImages(expectedDir, actualDir) {
  var expectedImages = _glob2.default.sync('' + expectedDir + IMAGE_FILES).map(function (p) {
    return _path2.default.relative(expectedDir, p);
  }).map(function (p) {
    return p[0] === _path2.default.sep ? p.slice(1) : p;
  });
  var actualImages = _glob2.default.sync('' + actualDir + IMAGE_FILES).map(function (p) {
    return _path2.default.relative(actualDir, p);
  }).map(function (p) {
    return p[0] === _path2.default.sep ? p.slice(1) : p;
  });
  var deletedImages = difference(expectedImages, actualImages);
  var newImages = difference(actualImages, expectedImages);
  return {
    expectedImages: expectedImages,
    actualImages: actualImages,
    deletedImages: deletedImages,
    newImages: newImages
  };
};