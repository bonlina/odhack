var Jimp = require("jimp");

var rnc = require("./rain-now-cast");

//downloadMap(35.36, 138.73, "MAP_MASK"); // Fuji
var CHOSHI = new rnc.Pos(35.701686, 140.876678);
var NAGASAKI = new rnc.Pos(32.752469, 129.871813);

for(var zoom = 2; zoom<10; zoom++){
    rnc.downloadAndMarkPoint(NAGASAKI, "MAP_MASK", zoom, null, "choshi_"+zoom+".png"); // choshi
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

        });
        console.log(bitmap);
        console.log(bitmapToString(bitmap));
    });
}

// utils

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
