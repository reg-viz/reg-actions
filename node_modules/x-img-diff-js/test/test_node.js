const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
const assert = require('assert');

const detectDiff = require('../src');

function decodePng(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, buffer) => {
      if (err) return reject(err);
      resolve(PNG.sync.read(buffer));
    });
  });
}

async function test() {
  const [img1, img2] = await Promise.all([
    decodePng(path.resolve(__dirname, '../demo/img/actual.png')),
    decodePng(path.resolve(__dirname, '../demo/img/expected.png')),
  ]);
  const diffResult = await detectDiff(img1, img2);
  assert(diffResult);
  console.log("diff result:", diffResult);
  console.log("the number of matching area:", diffResult.matches.length);
  console.log("img1's macthing area bounding rect:", diffResult.matches[0][0].bounding);
  console.log("img2's matching area bounding rect:", diffResult.matches[0][1].bounding);
  console.log("diff marker rectangulars in img1's matching area", diffResult.matches[0][0].diffMarkers.length);
}

test()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
