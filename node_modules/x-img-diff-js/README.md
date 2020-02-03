# x-img-diff-js
[![CircleCI](https://circleci.com/gh/reg-viz/x-img-diff-js.svg?style=svg)](https://circleci.com/gh/reg-viz/x-img-diff-js)
[![npm version](https://badge.fury.io/js/x-img-diff-js.svg)](https://badge.fury.io/js/x-img-diff-js)

JavaScript(Web Assembly) porting project for [Quramy/x-img-diff](https://github.com/Quramy/x-img-diff), which extracts structual information of a bit different 2 images.

## Demonstration
See https://reg-viz.github.io/x-img-diff-js/

## Usage
### Node.js
**You need Node.js >= v8.0.0**

```sh
npm install x-img-diff-js pngjs
```

```javascript
const fs = require('fs');
const PNG = require('pngjs').PNG;

const detectDiff = require('x-img-diff-js');

function decodePng(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, buffer) => {
      if (err) return reject(err);
      resolve(PNG.sync.read(buffer));
    });
  });
}

async function main() {
  const [img1, img2] = await Promise.all([
    decodePng('demo/img/actual.png')),
    decodePng('demo/img/expected.png')),
  ]);
  const diffResult = await detectDiff(img1, img2);
  console.log("diff result:", diffResult);
  console.log("the number of matching area:", diffResult.matches.length);
  console.log("img1's macthing area bounding rect:", diffResult.matches[0][0].bounding);
  console.log("img2's matching area bounding rect:", diffResult.matches[0][1].bounding);
  console.log("diff marker rectangulars in img1's matching area", diffResult.matches[0][0].diffMarkers.length);
}

main();
```

### Browser
See [demo derectory](https://github.com/reg-viz/x-img-diff-js/tree/master/demo) in this repository.

## API

### function `detectDiff`

```ts
detectDiff(img1: Image, img2: Image, opt?: DetectDiffOptions): Promise<DetectDiffResult>
```

- `img1`, `img2` - *Required* - Input images.
- `opt` - *Optional* - An object to configure detection.

### type `Image`

```ts
type Image = {
  width: number;
  height: number;
  data: Uint8Array;
}
```

### type `DetectDiffOptions`
A option object. See https://github.com/Quramy/x-img-diff#usage .

### type `DetectDiffResult`

```ts
type DetectDiffResult = {
  matces: MatchingRegions[];
  strayingRects: Rect[][];
}
```

- `matces` - An array of each matching region.
- `strayingRects` - An array of keypoints recatangle. `strayingRects[0]` corresponds to `img1`, `strayingRects[1]` does to `img2`.

### type `MatchingRegions`

```ts
type MatchingRegions = {
  bounding: Rect;
  center: Rect;
  diffMarkers: Rect[];
}[];
```

- `bounding` - Bounding rectangle of this region.
- `center` - Center rectangle of this region.
- `diffMarkers` - An array of different parts.

A `MatchingRegions` is a couple of objects. The 1st corresponds to `img1`, and 2nd does to `img2`.
And you can get how far the region moved using `center` property.

```ts
// m is an item of DetectDiffResult#mathes
const translationVector = {
  x: m[1].center.x - m[0].center.x,
  y: m[1].center.y - m[0].center.y,
};
```

### type `Rect`

```ts
type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Represents a rectangle.

### function `detectDiff.getBrowserJsPath`

```ts
detectDiff.getBrowserJsPath(): string 
```

Returns the absolute path of the JavaScript file which should be loaded in Browser env.

### function `detectDiff.getBrowserWasmPath`

```ts
detectDiff.getBrowserWasmPath(): string 
```

Returns the absolute path of the Web Assembly(.wasm) file which should be loaded in Browser env.

## How to build module

1. Clone this repo and change the current directory to it.

2. Get OpenCV source code

 ```
 git clone https://github.com/opencv/opencv.git
 cd opencv
 git checkout 3.1.0
 cd ..
 ```

3. Get x-img-diff source code

 ```
 git clone https://github.com/quramy/x-img-diff.git
 ```

4. Execute docker

```sh
$ docker-compose build
$ docker-compose run emcc
```

## Run module in your local machine

```
python -mhttp.server
open http://localhost:8000/index.html
```

## License
MIT.
