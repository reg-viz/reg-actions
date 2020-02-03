const path = require('path');
const fs = require('fs');

let m;
const p = function () {
  // Node.js < v8.x can't load Web Assembly,
  // so we should load this module when the first time detectDiff called.
  m = require('../build/cv-wasm_node.js');
  return new Promise(resolve => {
    const id = setInterval(() => {
      if (m._detectDiff) {
        resolve(m);
        clearInterval(id);
        return;
      }
    }, 10);
  });
};

function detectDiff(img1, img2, config, cb) {
  return p().then(m => m.detectDiff(m, img1, img2, config));
}

detectDiff.getBrowserJsPath = function() {
  return path.resolve(__dirname, '..', 'build', 'cv-wasm_browser.js');
};

detectDiff.getBrowserWasmPath = function() {
  return path.resolve(__dirname, '..', 'build', 'cv-wasm_browser.wasm');
};

module.exports = detectDiff;
