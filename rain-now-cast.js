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

var ETOROFU = new Pos(45.679122, 149.507813);
var KAGOSHIMA = new Pos(30.111624, 129.205078);
var FUKUOKA = new Pos(34.056975, 132.281250);
var YONAGUNI = new Pos(23.850415, 122.701172);
var JAPAN_RANGE = [
    [ETOROFU, KAGOSHIMA],
    [FUKUOKA, YONAGUNI],
];

/**
 * Roughly judges if it is in Japan. Use data only in this range
 */
Pos.prototype.isInJapan = function () {
    return JAPAN_RANGE.some((range) =>
        between(range[0].lat, this.lat, range[1].lat) && between(range[0].long, this.long, range[1].long)
    );
};

/**
 * a <= b <= c or c <= b <= a
 * @param a
 * @param b
 * @param c
 */
function between(a, b, c) {
    return (a <= b && b <= c) || (c <= b && b <= a);
}

var FIVE_MIN = 5 * 60 * 1000;

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
        var now = normalizeDate(new Date(new Date().getTime() - FIVE_MIN));
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
    return date;
}

function toStringUTC(date) {
    var utcDate = new Date(date.getTime() - 9 * 60 * 60 * 1000);
    return dateFormat(utcDate, "yyyymmddHHMM");
}

function downloadMap(pos, type, zoom, date, fileName) {
    return new Promise(function (resolve, reject) {
        if (!pos.isInJapan()) {
            reject();
            return;
        }
        var map = pos.mapToImage(zoom);
        var url = getImageUrlPrefix(type, date, zoom) + map.imgLong + "_" + map.imgLat + ".png";
        console.log("START", url);
        request.get(url, {encoding: null}, function (error, response, body) {
            console.log("FINISH", url);
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
    var fileName = "temp/" + Math.random() + ".png";
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
                        //throw err;
                        console.error("downloadMap: failed to read" + fileName, err);
                    } else {
                        var color = image.getPixelColor(map.pixLong, map.pixLat);
                        var amount = colorToAmount(color);
                        resolve(amount);
                    }
                });
            });
        });
}

function getDatesWithinAnHour(date) {
    return [date]; // temporarily
    var dates = [];
    for (var i = 0; i < 12; i++) {
        dates.push(new Date(date.getTime() + FIVE_MIN * i));
    }
    return dates
}

function getAmountsWithinAnHour(pos, zoom, date) {
    return Promise.all(getDatesWithinAnHour(date).map(function (date) {
        return getAmount(pos, zoom, date);
    }));
}

var COLOR_MM = [
    {color: '151515ff', amount: 100}, // Infinity
    {color: '282828ff', amount: 80},
    {color: '3d3d3dff', amount: 50},
    {color: '646464ff', amount: 30},
    {color: '828282ff', amount: 20},
    {color: 'a0a0a0ff', amount: 10},
    {color: 'bebebeff', amount: 5},
    {color: 'dcdcdcff', amount: 1}
];

function colorToAmount(color) {
    if (color === 0) {
        // If map only contains 0, the image seems to be filled with 0x00000000 instead of 0xffffff00
        return 0;
    }
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
exports.getAmountsWithinAnHour = getAmountsWithinAnHour;
exports.getDatesWithinAnHour = getDatesWithinAnHour;
