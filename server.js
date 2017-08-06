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
    var unixtime = parseInt(req.body.unixtime);
    var date = isNaN(unixtime) ? new Date() : new Date(unixtime);

    var promises = req.body.pos.map(function (elem) {
        var pos = rnc.Pos.fromObject(elem);
        return rnc.getAmount(pos, 6, date);
    });
    Promise.all(promises).then(function (amounts) {
        console.log("got amounts", amounts);
        res.json({
            pos: amounts.map(function (amount) {
                return {mm: amount};
            })
        });
    });
});

app.get('/map', function (req, res) {
    var pos = new rnc.Pos(req.query.lat, req.query.lng);
    console.log(pos);
    var zoom = parseInt(req.query.zoom) || 2;
    var type = req.query.mapType || "MAP_MASK";
    var date = type === "MAP_MASK" ? null : new Date();
    var fileName = "req.png";
    rnc.downloadAndMarkPoint(pos, rnc.MAP_TYPE[type], zoom, date, fileName).then(function () {
        res.sendFile(__dirname + "/" + fileName);
    });
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});