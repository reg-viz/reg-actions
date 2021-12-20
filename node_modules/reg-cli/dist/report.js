'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _mustache = require('mustache');

var _mustache2 = _interopRequireDefault(_mustache);

var _xImgDiffJs = require('x-img-diff-js');

var detectDiff = _interopRequireWildcard(_xImgDiffJs);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var loadFaviconAsDataURL = function loadFaviconAsDataURL(type) {
  var fname = _path2.default.resolve(__dirname, '../report/assets/favicon_' + type + '.png');
  var buffer = _fs2.default.readFileSync(fname);
  return 'data:image/png;base64,' + buffer.toString('base64');
};

// $FlowIgnore


var encodeFilePath = function encodeFilePath(filePath) {
  return filePath.split(_path2.default.sep).map(function (p) {
    return encodeURIComponent(p);
  }).join(_path2.default.sep);
};

var createJSONReport = function createJSONReport(params) {
  return {
    failedItems: params.failedItems,
    newItems: params.newItems,
    deletedItems: params.deletedItems,
    passedItems: params.passedItems,
    expectedItems: params.expectedItems,
    actualItems: params.actualItems,
    diffItems: params.diffItems,
    actualDir: '' + params.urlPrefix + _path2.default.relative(_path2.default.dirname(params.json), params.actualDir),
    expectedDir: '' + params.urlPrefix + _path2.default.relative(_path2.default.dirname(params.json), params.expectedDir),
    diffDir: '' + params.urlPrefix + _path2.default.relative(_path2.default.dirname(params.json), params.diffDir)
  };
};

var createHTMLReport = function createHTMLReport(params) {
  var file = _path2.default.join(__dirname, '../template/template.html');
  var js = _fs2.default.readFileSync(_path2.default.join(__dirname, '../report/ui/dist/report.js'));
  var template = _fs2.default.readFileSync(file);
  var json = {
    type: params.failedItems.length === 0 ? 'success' : 'danger',
    hasNew: params.newItems.length > 0,
    newItems: params.newItems.map(function (item) {
      return { raw: item, encoded: encodeFilePath(item) };
    }),
    hasDeleted: params.deletedItems.length > 0,
    deletedItems: params.deletedItems.map(function (item) {
      return { raw: item, encoded: encodeFilePath(item) };
    }),
    hasPassed: params.passedItems.length > 0,
    passedItems: params.passedItems.map(function (item) {
      return { raw: item, encoded: encodeFilePath(item) };
    }),
    hasFailed: params.failedItems.length > 0,
    failedItems: params.failedItems.map(function (item) {
      return { raw: item, encoded: encodeFilePath(item) };
    }),
    actualDir: params.fromJSON ? params.actualDir : '' + params.urlPrefix + _path2.default.relative(_path2.default.dirname(params.report), params.actualDir),
    expectedDir: params.fromJSON ? params.expectedDir : '' + params.urlPrefix + _path2.default.relative(_path2.default.dirname(params.report), params.expectedDir),
    diffDir: params.fromJSON ? params.diffDir : '' + params.urlPrefix + _path2.default.relative(_path2.default.dirname(params.report), params.diffDir),
    ximgdiffConfig: {
      enabled: params.enableClientAdditionalDetection,
      workerUrl: params.urlPrefix + 'worker.js'
    }
  };
  var faviconType = json.hasFailed || json.hasNew || json.hasDeleted ? 'failure' : 'success';
  var view = {
    js: js,
    report: JSON.stringify(json),
    faviconData: loadFaviconAsDataURL(faviconType)
  };
  return _mustache2.default.render(template.toString(), view);
};

function createXimdiffWorker(params) {
  var file = _path2.default.join(__dirname, '../template/worker_pre.js');
  var moduleJs = _fs2.default.readFileSync(_path2.default.join(__dirname, '../report/ui/dist/worker.js'), 'utf8');
  var wasmLoaderJs = _fs2.default.readFileSync(detectDiff.getBrowserJsPath(), 'utf8');
  var template = _fs2.default.readFileSync(file);
  var ximgdiffWasmUrl = params.urlPrefix + 'detector.wasm';
  return _mustache2.default.render(template.toString(), { ximgdiffWasmUrl: ximgdiffWasmUrl }) + '\n' + moduleJs + '\n' + wasmLoaderJs;
}

exports.default = function (params) {
  if (!!params.report) {
    var html = createHTMLReport(params);
    _mkdirp2.default.sync(_path2.default.dirname(params.report));
    _fs2.default.writeFileSync(params.report, html);
    if (!!params.enableClientAdditionalDetection) {
      var workerjs = createXimdiffWorker(params);
      _fs2.default.writeFileSync(_path2.default.resolve(_path2.default.dirname(params.report), 'worker.js'), workerjs);
      var wasmBuf = _fs2.default.readFileSync(detectDiff.getBrowserWasmPath());
      _fs2.default.writeFileSync(_path2.default.resolve(_path2.default.dirname(params.report), 'detector.wasm'), wasmBuf);
    }
  }

  var json = createJSONReport(params);
  if (!params.fromJSON) {
    _mkdirp2.default.sync(_path2.default.dirname(params.json));
    _fs2.default.writeFileSync(params.json, JSON.stringify(json));
  }
  return json;
};