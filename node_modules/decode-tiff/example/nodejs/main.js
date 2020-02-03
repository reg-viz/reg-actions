const { decode } = require("../../");
const { PNG } = require("pngjs");
const fs = require("fs");

const { width, height, data } = decode(fs.readFileSync(__dirname + "/lena_color.tiff"));

const png =  new PNG({ width, height });
png.data = data;
fs.writeFileSync(__dirname + "/lena.png", PNG.sync.write(png));
