'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }(); // $FlowIgnore
// $FlowIgnore


var _imgDiffJs = require('img-diff-js');

var _md5File = require('md5-file');

var _md5File2 = _interopRequireDefault(_md5File);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var getMD5 = function getMD5(file) {
  return new Promise(function (resolve, reject) {
    (0, _md5File2.default)(file, function (err, hash) {
      if (err) reject(err);
      resolve(hash);
    });
  });
};

var isPassed = function isPassed(_ref) {
  var width = _ref.width,
      height = _ref.height,
      diffCount = _ref.diffCount,
      thresholdPixel = _ref.thresholdPixel,
      thresholdRate = _ref.thresholdRate;

  if (typeof thresholdPixel === "number") {
    return diffCount <= thresholdPixel;
  } else if (typeof thresholdRate === "number") {
    var totalPixel = width * height;
    var ratio = diffCount / totalPixel;
    return ratio <= thresholdRate;
  }
  return diffCount === 0;
};

var createDiff = function createDiff(_ref2) {
  var actualDir = _ref2.actualDir,
      expectedDir = _ref2.expectedDir,
      diffDir = _ref2.diffDir,
      image = _ref2.image,
      matchingThreshold = _ref2.matchingThreshold,
      thresholdRate = _ref2.thresholdRate,
      thresholdPixel = _ref2.thresholdPixel,
      enableAntialias = _ref2.enableAntialias;

  return Promise.all([getMD5(_path2.default.join(actualDir, image)), getMD5(_path2.default.join(expectedDir, image))]).then(function (_ref3) {
    var _ref4 = _slicedToArray(_ref3, 2),
        actualHash = _ref4[0],
        expectedHash = _ref4[1];

    if (actualHash === expectedHash) {
      if (!process || !process.send) return;
      return process.send({ passed: true, image: image });
    }
    var diffImage = image.replace(/\.[^\.]+$/, ".png");
    return (0, _imgDiffJs.imgDiff)({
      actualFilename: _path2.default.join(actualDir, image),
      expectedFilename: _path2.default.join(expectedDir, image),
      diffFilename: _path2.default.join(diffDir, diffImage),
      options: {
        threshold: matchingThreshold,
        includeAA: !enableAntialias
      }
    }).then(function (_ref5) {
      var width = _ref5.width,
          height = _ref5.height,
          diffCount = _ref5.diffCount;

      var passed = isPassed({ width: width, height: height, diffCount: diffCount, thresholdPixel: thresholdPixel, thresholdRate: thresholdRate });
      if (!process || !process.send) return;
      process.send({ passed: passed, image: image });
    });
  });
};

process.on('message', function (data) {
  createDiff(data);
});