'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var chalk = require('chalk');

exports.default = {
  info: function info(text) {
    console.log(chalk.cyan(text));
  },
  warn: function warn(text) {
    console.log(chalk.gray(text));
  },
  success: function success(text) {
    console.log(chalk.green(text));
  },
  fail: function fail(text) {
    console.log(chalk.red(text));
  }
};