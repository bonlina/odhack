var rnc = require('./rain-now-cast');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.get('/', function (req, res) {
    res.sendFile(__dirname + "/test.html");
});

app.post('/api', function (req, res) {
    console.log(req.body);
    console.log(req);
    console.log(JSON.parse(req.body));
    res.send("[12, 34]")
//    rnc.getAmount()
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});