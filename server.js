var rnc = require('./rain-now-cast');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.sendFile(__dirname + "/test.html");
});

app.post('/api', function (req, res) {
    console.log(req.body);
    //res.json(req.body);
    // TODO: send real data in given points
    res.json({
        pos:[
            {mm: 10},
            {mm: 5}
        ]
    })
//    rnc.getAmount()
});

app.get('/map', function (req, res) {
    var pos = new rnc.Pos(req.query.lat, req.query.lng);
    console.log(pos);
    var zoom = parseInt(req.query.zoom) || 2;
    var fileName = "req.png";
    rnc.downloadAndMarkPoint(pos, rnc.MAP_TYPE.MAP_MASK, zoom, null, fileName, function () {
        res.sendFile(__dirname + "/" + fileName);
    });
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});