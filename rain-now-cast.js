var request = require("request");
var fs = require("fs");
var Jimp = require("jimp");
var dateFormat = require('dateformat');

/**
 * Position model
 * @param lat ido
 * @param long keido
 * @constructor
 */
function Pos(lat, long) {
    this.lat = lat;
    this.long = long;
}

/**
 * Map from (lat, long) and zoom level to mesh pixel
 * @param zoom zoom level from 1 to any number
 * @returns {{imgLat: Number, imgLong: Number, pixLat: Number, pixLong: Number}}
 */
Pos.prototype.mapToImage = function(zoom) {
    if(!zoom){
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
 *   MAP_MASK: white map
 *   HRKSNC_GRAY: grayscale rain amount
 * @param date
 * @param zoom
 * @returns {string}
 */
function getImageUrlPrefix(type, date, zoom) {
    var dateString;
    if (!date || type === "MAP_MASK") {
        dateString = "none";
    } else {
        dateString = dateFormat(date, "yyyymmddHHMM");
        dateString[dateString.length - 1] = "0";
    }
    return "http://www.jma.go.jp/jp/commonmesh/map_tile/" + type + "/" + dateString + "/" + dateString + "/zoom" + zoom + "/";
}

function downloadMap(pos, type, zoom, date, fileName, callback) {
    var map = pos.mapToImage(zoom);
    var url = getImageUrlPrefix(type, date, zoom) + map.imgLong + "_" + map.imgLat + ".png";
    console.log(url)
    request.get(url, {encoding: null}, function (error, response, body) {
        var buffer = new Buffer(body);
        fs.writeFile(fileName, buffer, function () {
            callback();
        });
    });
}

function markPoint(pos, zoom, fileName, callback) {
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
        image.write(fileName);
        callback();
    });
}


function downloadAndMarkPoint(pos, type, zoom, date, fileName){
    downloadMap(pos, type, zoom, date, fileName, function(){
       markPoint(pos, zoom, fileName, function(){});
    });
}

function getAmount(pos, zoom, date, callback){
    var fileName = "get_amount.png";
    downloadMap(pos, "HRKSNC_GRAY", zoom, date, fileName, function(){
        Jimp.read(fileName, function (err, image) {
            if(err) throw err;
            var color = image.getPixelColor(pos.pixLong, pos.pixLat);
            callback(colorToAmount(color));
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
    for (var val of COLOR_MM) {
        if (color <= val.color) {
            return val.amount;
        }
    }
    if (color === "ffffff00") {
        return 0;
    }
    throw "unknown color";
}

exports.Pos = Pos;
exports.downloadAndMarkPoint = downloadAndMarkPoint;
exports.getAmount = getAmount;

// Usages
// console.log(getImageUrlPrefix("MAP_MASK", new Date(), 2));
