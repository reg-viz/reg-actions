'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // $FlowIgnore


var _child_process = require('child_process');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ProcessAdaptor = function () {
  function ProcessAdaptor(emitter) {
    _classCallCheck(this, ProcessAdaptor);

    this._process = (0, _child_process.fork)(_path2.default.resolve(__dirname, './diff.js'));
    this._isRunning = false;
    this._emitter = emitter;
  }

  _createClass(ProcessAdaptor, [{
    key: 'isRunning',
    value: function isRunning() {
      return this._isRunning;
    }
  }, {
    key: 'run',
    value: function run(params) {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this._isRunning = true;
        if (!_this._process || !_this._process.send) resolve();
        _this._process.send(params);
        _this._process.once('message', function (result) {
          _this._isRunning = false;
          _this._emitter.emit('compare', {
            type: result.passed ? 'pass' : 'fail', path: result.image
          });
          resolve(result);
        });
      });
    }
  }, {
    key: 'close',
    value: function close() {
      if (!this._process || !this._process.kill) return;
      this._process.kill();
    }
  }]);

  return ProcessAdaptor;
}();

exports.default = ProcessAdaptor;