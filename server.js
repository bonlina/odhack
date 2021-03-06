var rnc = require('./rain-now-cast');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use('/static', express.static(__dirname + '/static'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + "/weathermap.html");
});

app.post('/api', function (req, res) {
    var unixtime = parseInt(req.body.unixtime);
    var date = isNaN(unixtime) ? new Date() : new Date(unixtime);

    var promises = req.body.pos.map(function (elem) {
        var pos = rnc.Pos.fromObject(elem);
        return rnc.getAmountsWithinAnHour(pos, 6, date);
    });
    Promise.all(promises).then(function (amounts) {
        res.json({
            pos: amounts.map(function (amounts) {
                return {
                    each5min: amounts.map(mm => {
                        return {mm};
                    }),
                    mm: amounts[0],
                };
            }),
            dates: rnc.getDatesWithinAnHour(date).map(function (date) {
                return date.toString();
            })
        });
    }, function (){
        res.json({
            error: true
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
    }, function(){
        res.sendFile(__dirname + "/ooj.png");
    });
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});