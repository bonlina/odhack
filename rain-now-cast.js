var request = require("request");
var fs = require("fs");
var Jimp = require("jimp");
var dateFormat = require('dateformat');

var MAP_TYPE = {
    MAP_MASK: "http://www.jma.go.jp/jp/commonmesh/map_tile/MAP_MASK", // White map
    HRKSNC_GRAY: "http://www.jma.go.jp/jp/highresorad/highresorad_tile/HRKSNC_GRAY", // Grayscale rain amount
};

/**
 * Position model
 * @param lat ido
 * @param long keido
 * @constructor
 */
function Pos(lat, long) {
    if (typeof lat === "string") {
        lat = Number(lat);
    }
    if (typeof long === "string") {
        long = Number(long);
    }
    this.lat = lat;
    this.long = long;
}

Pos.fromObject = function (obj) {
    return new Pos(obj.lat, obj.lng);
};

/**
 * Map from (lat, long) and zoom level to mesh pixel
 * @param zoom zoom level from 1 to any number
 * @returns {{imgLat: Number, imgLong: Number, pixLat: Number, pixLong: Number}}
 */
Pos.prototype.mapToImage = function (zoom) {
    if (!zoom) {
        zoom = 2;
    }
    var lat_ = (61 - this.lat) / (54 / Math.pow(2, zoom));
    var lat_int = parseInt(lat_);
    var long_ = (this.long - 100) / (70 / Math.pow(2, zoom));
    var long_int = parseInt(long_);
    return {
        imgLat: lat_int,
        imgLong: long_int,
        pixLat: parseInt(256 * (lat_ - lat_int)),
        pixLong: parseInt(256 * (long_ - long_int)),
    };
};

/**
 *
 * @param type
 * @param date
 * @param zoom
 * @returns {string}
 */
function getImageUrlPrefix(type, date, zoom) {
    var from, to;
    if (!date || type === MAP_TYPE.MAP_MASK) {
        from = to = "none";
    } else {
        date = normalizeDate(date);
        // Need to set past because latest prediction is not always available
        var fiveMin = 5 * 60 * 1000;
        var now = normalizeDate(new Date(new Date().getTime() - fiveMin));
        if (date.getTime() < now.getTime()) {
            // past date
            from = to = toStringUTC(date)
        } else {
            // prediction date
            from = toStringUTC(now);
            to = toStringUTC(date);
        }
    }
    return type + "/" + from + "/" + to + "/zoom" + zoom + "/";
}

function normalizeMinutes(min) {
    return parseInt(min / 5) * 5;
}

function normalizeDate(date) {
    date.setMinutes(normalizeMinutes(date.getMinutes()));
    date.setSeconds(0);
    date.setMilliseconds(0);
    console.log("normalized", date);
    return date;
}

function toStringUTC(date) {
    var utcDate = new Date(date.getTime() - 9 * 60 * 60 * 1000);
    return dateFormat(utcDate, "yyyymmddHHMM");
}

function downloadMap(pos, type, zoom, date, fileName) {
    return new Promise(function (resolve) {
        var map = pos.mapToImage(zoom);
        var url = getImageUrlPrefix(type, date, zoom) + map.imgLong + "_" + map.imgLat + ".png";
        console.log(url, map);
        request.get(url, {encoding: null}, function (error, response, body) {
            var buffer = new Buffer(body);
            fs.writeFile(fileName, buffer, function () {
                resolve();
            });
        });
    });
}

function markPoint(pos, zoom, fileName) {
    return new Promise(function (resolve) {
        Jimp.read(fileName, function (err, image) {
            if (err) {
                throw err;
            }
            var map = pos.mapToImage(zoom);

            image.scan(map.pixLong - 1, map.pixLat - 1, 3, 3, function (x, y, idx) {
                this.bitmap.data[idx + 0] = 255; // red
                this.bitmap.data[idx + 1] = 0; // green
                this.bitmap.data[idx + 2] = 0; // blue
                this.bitmap.data[idx + 3] = 255; // alpha
            });
            image.write(fileName, function () {
                resolve();
            });
        });
    });
}


function downloadAndMarkPoint(pos, type, zoom, date, fileName) {
    return downloadMap(pos, type, zoom, date, fileName)
        .then(function () {
            return markPoint(pos, zoom, fileName);
        });
}


function getAmount(pos, zoom, date) {
    var fileName = "temp/"+Math.random()+".png";
    var map = pos.mapToImage(zoom);
    if (zoom >= 7) {
        console.error("Resolution for amount should be Maximum 6");
        zoom = 6;
    }
    return downloadMap(pos, MAP_TYPE.HRKSNC_GRAY, zoom, date, fileName)
        .then(function () {
            return new Promise(function (resolve) {
                Jimp.read(fileName, function (err, image) {
                    if (err) {
                        throw err;
                    }
                    var color = image.getPixelColor(map.pixLong, map.pixLat);
                    var amount = colorToAmount(color);
                    resolve(amount);
                });
            });
        });
}

var COLOR_MM = [
    {color: '151515ff', amount: 80},
    {color: '282828ff', amount: 50},
    {color: '3d3d3dff', amount: 30},
    {color: '646464ff', amount: 20},
    {color: '828282ff', amount: 10},
    {color: 'a0a0a0ff', amount: 5},
    {color: 'bebebeff', amount: 1},
    {color: 'dcdcdcff', amount: 0}
];

function colorToAmount(color) {
    color = color.toString(16);
    for (var val of COLOR_MM) {
        if (color <= val.color) {
            return val.amount;
        }
    }
    if (color === "ffffff00") {
        return 0;
    }
    throw "unknown color: " + color;
}

exports.Pos = Pos;
exports.MAP_TYPE = MAP_TYPE;
exports.downloadAndMarkPoint = downloadAndMarkPoint;
exports.getAmount = getAmount;
