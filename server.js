var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.sendFile(__dirname+"/test.html");
});

app.post('/api', function (req, res) {
        res.send('[12, 34]');
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});