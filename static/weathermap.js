function initMap() {
    // change mode (walking/driving)
    $('input[type="radio"]').on('change', function(e) {
        document.getElementById('mode').value = this.id;
        calculateAndDisplayRoute(directionsDisplay, directionsService, markerArray, stepDisplay, map);
    });

    var markerArray = [];

    // Instantiate a directions service.
    var directionsService = new google.maps.DirectionsService;

    // Create a map and center it on Manhattan.
    var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: {lat: 40.771, lng: -73.974},
        mapTypeId: 'terrain'
    });

    // Create a renderer for directions and bind it to the map.
    var directionsDisplay = new google.maps.DirectionsRenderer({
        map: map,
        draggable: true,
        panel: document.getElementById('directionsPanel')
    });

    // Instantiate an info window to hold step text.
    var stepDisplay = new google.maps.InfoWindow;

    directionsDisplay.addListener('directions_changed', function() {
        showSteps(directionsDisplay.getDirections(), markerArray, stepDisplay, map, 0);
    });
    directionsDisplay.addListener('routeindex_changed', function() {
        showSteps(directionsDisplay.getDirections(), markerArray, stepDisplay, map, this.getRouteIndex());
    });

    // Display the route between the initial start and end selections.
    calculateAndDisplayRoute(directionsDisplay, directionsService, markerArray, stepDisplay, map);
}

function calculateAndDisplayRoute(directionsDisplay, directionsService, markerArray, stepDisplay, map) {
    // First, remove any existing markers from the map
    for (var i = 0; i < markerArray.length; i++) {
        markerArray[i].setMap(null);
    }
    markerArray = [];

    // Retrieve the start and end locations and create a DirectionsRequest.
    directionsService.route({
        origin: document.getElementById('origin-input').value,
        destination: document.getElementById('destination-input').value,
        travelMode: document.getElementById('mode').value,
        provideRouteAlternatives: true,
        //region: 'ja',
        unitSystem: google.maps.UnitSystem.METRIC,
        transitOptions: {
            //arrivalTime: Date,
            departureTime: getTimeNow(),  // for the time N milliseconds from now.
            modes: ['RAIL', 'BUS', 'SUBWAY', 'TRAIN', 'TRAM'],
            routingPreference: 'FEWER_TRANSFERS'
        }
    }, function(response, status) {
        // Route the directions and pass the response to a function to create
        // markers for each step.
        if (status === 'OK') {
            //document.getElementById('warnings-panel').innerHTML = '<b>' + response.routes[0].warnings + '</b>';
            directionsDisplay.setDirections(response);
            showSteps(response, markerArray, stepDisplay, map, 0);
        } else {
            window.alert('Directions request failed due to ' + status);
        }
    });
}

function showSteps(directionResult, markerArray, stepDisplay, map, routeIndex) {
    // alert(routeIndex);

    // First, remove any existing markers from the map.
    while(markerArray.length) {
        markerArray.pop().setMap(null);
    }
    map.clearOverlays;


    var sun = {
        url: "/static/icons/sunny.png",
        scaledSize: new google.maps.Size(50, 50), // scaled size
        origin: new google.maps.Point(0, 0), // origin
        anchor: new google.maps.Point(0, 0) // anchor
    };

    var sun_under_cloud_and_rain = {
        url: "/static/icons/cloud.png",
        scaledSize: new google.maps.Size(50, 50), // scaled size
        origin: new google.maps.Point(0, 0), // origin
        anchor: new google.maps.Point(0, 0) // anchor
    };

    var heavy_rain = {
        url: "/static/icons/heavy%20rain.png",
        scaledSize: new google.maps.Size(50, 50), // scaled size
        origin: new google.maps.Point(0, 0), // origin
        anchor: new google.maps.Point(0, 0) // anchor
    };

    var owm_icon = {
        scaledSize: new google.maps.Size(50, 50), // scaled size
        origin: new google.maps.Point(0, 0), // origin
        anchor: new google.maps.Point(0, 0) // anchor
    };

    //alert(directionResult.routes.length);
    var distanceWhenShownLastTime = 99999;
    var myRoute = directionResult.routes[routeIndex].legs[0];

    //alert(root.legs.length);
    // For each step, place a marker, and add the text to the marker's infowindow.
    // Also attach the marker to an array so we can keep track of it and remove it
    // when calculating new routes.
    showHighs(myRoute, map);

    var getODWeatherPromises = [];
    var getOWMWeatherPromises = [];
    var od_weather = new Array(myRoute.steps.length);
    var owm_weather = new Array(myRoute.steps.length);
    var weather_datapoint_cnt = 0;

    for (var i = 0; i < myRoute.steps.length; i++) {
        var step = myRoute.steps[i];
        var start_location = step.start_location;

        if ((i!==0) && ((distanceWhenShownLastTime > (400 * map.getZoom()) || (i===1) || (i === myRoute.steps.length-2)))) {
            // collect weather data from different sources
            getODWeatherPromises.push(getODWeather(start_location, od_weather, weather_datapoint_cnt));
            getOWMWeatherPromises.push(getOWMWeather_viaCORS(start_location, owm_weather, weather_datapoint_cnt));
            weather_datapoint_cnt += 1;
            distanceWhenShownLastTime = 0;
        } else {
            // don't show weather
            distanceWhenShownLastTime = distanceWhenShownLastTime + step.distance.value;
        }

    }
    // TODO 1: write trash to remember all queries, not only the last one
    // TODO 2: use distanceWhenShownLastTime and show waeather in time
    Promise.all(getODWeatherPromises).then(values => {
        for (var i = 0; i < values.length; i++) {
            mm = values[i].pos[0].mm;
            var marker = new google.maps.Marker;
            markerArray.push(marker);
            marker.setPosition(start_location);
            if (mm === 0) {
                marker.setIcon(sun_under_cloud_and_rain);
            } else if (mm === 1) {
                marker.setIcon(sun_under_cloud_and_rain);
            } else {
                marker.setIcon(sun_under_cloud_and_rain);
            }
            //marker.setMap(map); // TODO: start to use open data.
        }
    });
    // TODO: write trash to remember all queries, not only the last one
    Promise.all(getOWMWeatherPromises).then(values => {
        for (var i = 0; i < values.length; i++) {
            icon = JSON.parse(values[i]).list[0].weather[0].icon;
            var marker = new google.maps.Marker;
            markerArray.push(marker);
            marker.setPosition(start_location);
            owm_icon.url = "http://openweathermap.org/img/w/" + icon + ".png";
            marker.setIcon(owm_icon);
            marker.setMap(map);
        }
    });
}

// TODO use it
function attachInstructionText(stepDisplay, marker, text, map) {
    google.maps.event.addListener(marker, 'click', function() {
        // Open an info window when the marker is clicked on, containing the text
        // of the step.
        stepDisplay.setContent(text);
        stepDisplay.open(map, marker);
    });
}

function getODWeather(latLng, od_weather, i) {
    return new Promise(function (resolve) {
        $.ajax({
            type: 'POST',
            url: "/api",
            data: {
                unixtime: getTimeNow(),
                pos: [{lat: latLng.lat(), lng: latLng.lng()}]
            },
            success: function (data) {
                od_weather[i] = data;
                resolve(data);
            },
            dataType: "json"
        });
    })
}

function getTimeNow() {
    return new Date(Date.now() + 1000);  // for the time N milliseconds from now
}

// Create the XHR object.
function createCORSRequest(method, url) {
    var xhr = new XMLHttpRequest();
    // if ("withCredentials" in xhr) {
    //     // XHR for Chrome/Firefox/Opera/Safari
    //     xhr.open(method, url, true);
    // } else if (typeof XDomainRequest !== "undefined") {
    //     // XDomainRequest for IE
    //     xhr = new XDomainRequest();
    //     xhr.open(method, url);
    // } else {
    //     // CORS not supported
    //     xhr = null;
    // }
    return xhr;
}

// Make the actual CORS request
function getOWMWeather_viaCORS(latLng, owm_weather, i) {
    return new Promise(function (resolve) {
        // This is a sample server that supports CORS.
        var url = 'http://api.openweathermap.org/data/2.5/forecast?lat=' + latLng.lat() + '&lon=' + latLng.lng() + '&units=metric&appid=cbcafe8bb09e522c0226c7a4b5ca05cc';

        var xhr = createCORSRequest('GET', url);
        if (!xhr) {
            console.log('CORS not supported');
            return;
        }

        // Response handlers
        xhr.onload = function () {
            owm_weather[i] = xhr.responseText;
            //console.log('Response from CORS request to ' + text);
            resolve(xhr.responseText);
        };

        xhr.onerror = function () {
            console.log('Woops, there was an error making the request.');
        };

        //xhr.send();
    });
}
