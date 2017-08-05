var Jimp = require("jimp");
var request = require("request");
var fs = require("fs");
var dateFormat = require('dateformat');

/**
 * Map from (lat, long) and zoom level to mesh pixel
 * @param lat ido
 * @param long keido
 * @param zoom zoom level from 1 to any number
 * @returns {{imgLat: Number, imgLong: Number, pixLat: Number, pixLong: Number}}
 */
function latLongToImgPos(lat, long, zoom){
    var lat_ = (61-lat)/(54/Math.pow(2, zoom));
    var lat_int = parseInt(lat_);
    var long_ = (long-100)/(70/Math.pow(2, zoom));
    var long_int = parseInt(long_);
    return {
        imgLat: lat_int,
        imgLong: long_int,
        pixLat: parseInt(256*(lat_-lat_int)),
        pixLong: parseInt(256*(long_-long_int)),
    };
}


/**
 *
 * @param type
 *   MAP_MASK: while map
 *   HRKSNC_GRAY: grayscale rain amount
 * @param date
 * @param zoom
 * @returns {string}
 */
function getImageUrlPrefix(type, date, zoom) {
    var dateString;
    if(!date || type === "MAP_MASK"){
        dateString = "none";
    } else {
        dateString = dateFormat(date, "yyyymmddHHMM");
        dateString[dateString.length - 1] = "0";
    }
    return "http://www.jma.go.jp/jp/commonmesh/map_tile/" + type + "/" + dateString + "/" + dateString + "/zoom"+zoom+"/";
}

console.log(getImageUrlPrefix("MAP_MASK", new Date(), 2));

function downloadMap(lat, long, type, zoom, date, fileName){
    var temp_name = fileName+"_temp.png";
    var obj = latLongToImgPos(lat, long, zoom);
    console.log("position", obj);
    var url = getImageUrlPrefix(type, date, zoom) + obj.imgLong + "_" + obj.imgLat + ".png";
    /*request(url, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log('body:', body); // Print the HTML for the Google homepage.
    })*/
    console.log(url);
//    request(url).pipe(fs.createWriteStream(temp_name));
    request.get(url, {encoding: null},function(error, response, body) {
        var buffer = new Buffer(body);
        fs.writeFile(temp_name, buffer, function(){
            Jimp.read(temp_name, function (err, image) {
                if(err){
                    throw err;
                }
                var wh = 50;
//                image.setPixelColor(0xFFFFFFFF, obj.pixLong, obj.pixLat);

                image.scan(obj.pixLong-1, obj.pixLat-1, 3, 3, function(x, y, idx){
                    this.bitmap.data[idx + 0] = 255; // red
                    this.bitmap.data[idx + 1] = 0; // green
                    this.bitmap.data[idx + 2] = 0; // blue
                    this.bitmap.data[idx + 3] = 255; // alpha
                });
/*                image.crop(
                    Math.max(0, obj.pixLong-wh),
                    Math.max(0, obj.pixLat-wh),
                    wh*2,
                    wh*2);*/
//        Math.min(image.bitmap.height, obj.pixLat+wh),
//            Math.min(image.bitmap.width, obj.pixLong+wh));
                image.write(fileName);
            });
        });
    });

}

//downloadMap(35.36, 138.73, "MAP_MASK"); // Fuji
for(var zoom = 2; zoom<10; zoom++){
    downloadMap(35.701686, 140.876678, "MAP_MASK", zoom, null, "choshi_"+zoom+".png"); // choshi
}

function test(){
    Jimp.read("./test.png", function (err, image) {
        if (err) throw err;
        var pixel = image.getPixelColor(0, 0);
        console.log(pixel.toString(16));
        console.log(Jimp.intToRGBA(pixel));
        /*
         image.resize(1024, 1024)            // resize
         .quality(60)                 // set JPEG quality
         .greyscale()                 // set greyscale
         .write("test.jpg"); // save
         */
//	var map = new Set();
        var X = image.bitmap.width;
        var Y = image.bitmap.height;
        var bitmap = [];
        for (var x = 0; x < X; x++) {
            bitmap.push([]);
        }
        var map = {};
        image.scan(0, 0, X, Y, function (x, y, idx) {
            // x, y is the position of this pixel on the image
            // idx is the position start position of this rgba tuple in the bitmap Buffer
            // this is the image

            var color = image.getPixelColor(x, y).toString(16);
            var amount = colorToAmount(color);
            bitmap[x][y] = amount;



            /*
             map[color] = (map[color || 0) + 1;
             */
//        map.add(color);

            // rgba values run from 0 - 255
            // e.g. this.bitmap.data[idx] = 0; // removes red from this pixel
        });
        /*
         var arr = [];
         for(var v of map.values()){
         arr.push(v);
         }
         arr.sort();
         console.log(arr);*/
        /*
         var arr = [];
         for (var color in map) {
         var amount = map[color];
         arr.push({color, amount});
         }
         arr.sort(function (a, b) {
         return a.color > b.color;
         })
         console.log(map);
         console.log(arr);
         */
        console.log(bitmap);
        console.log(bitmapToString(bitmap));
    });
}

// utils

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

function pad0(num){
    return ( '00' + num ).slice( -2 );
}

function bitmapToString(bitmap) {
    var output = "";
    for (var i = 0; i < bitmap[0].length; i++) {
        for (var j = 0; j < bitmap.length; j++) {
            output += pad0(bitmap[j][i])+" ";
        }
        output += "\n";
    }
    return output;
}
