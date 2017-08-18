var USE_NOW_CAST = true;
var USE_OPEN_WEATHER_MAP = true;
var USE_OPEN_WEATHER_MAP_SAMPLE_DATA = false; // Use sample data so that we don't get API limitation
var OPEN_WEATHER_MAP_TIME_WINDOW_HOURS = 3;
var HOW_OFTEN_SHOW_WEATHER_DATA = 15; // if smaller then more ofter

function initMap() {
    var markerArray = [];

    // Instantiate a directions service.
    var directionsService = new google.maps.DirectionsService;

    // Create a map and center it on Manhattan.
    var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        // TODO: use location of user https://developers.google.com/maps/documentation/javascript/geolocation
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

    var previousDirections = null;
    var previousRouteIndex = -1;
    directionsDisplay.addListener('directions_changed', function() {
        var directions = directionsDisplay.getDirections();
        if (previousDirections !== directions || previousRouteIndex !== this.getRouteIndex()) {
            console.log("directions_changed");
            showSteps(directionsDisplay.getDirections(), markerArray, stepDisplay, map, 0);
            previousDirections = directions;
            previousRouteIndex = this.getRouteIndex();
        } else {
//            console.log("skip directions_changed");
        }
    });

    directionsDisplay.addListener('routeindex_changed', function() {
        var directions = directionsDisplay.getDirections();
        if (previousDirections !== directions || previousRouteIndex !== this.getRouteIndex()) {
            showSteps(directionsDisplay.getDirections(), markerArray, stepDisplay, map, this.getRouteIndex());
            previousDirections = directions;
            previousRouteIndex = this.getRouteIndex();
        } else {
//            console.log("skip route_change");
        }
    });

    // change mode (walking/driving)
    $('input[type="radio"]').on('change', function(e) {
        document.getElementById('mode').value = this.id;
    });

    // Display the route between the initial start and end selections.
    calculateAndDisplayRoute(directionsDisplay, directionsService, markerArray, stepDisplay, map, null, null);

    new AutocompleteDirectionsHandler(directionsDisplay, directionsService, markerArray, stepDisplay, map);
}

function removeAllMarkers(markerArray) {
    while (markerArray.length > 0) {
        markerArray.pop().setMap(null);
    }
}

function calculateAndDisplayRoute(directionsDisplay, directionsService, markerArray, stepDisplay, map, originPlace, destinationPlace) {
    console.log("call calculateAndDisplayRoute");
    // First, remove any existing markers from the map
    removeAllMarkers(markerArray);
    var directions = directionsDisplay.getDirections();

    var origin;
    if (originPlace) {
        origin = originPlace;
    } else {
        origin = (directions) ? directions.request.origin : document.getElementById('origin-input').value;
    }
    var destination;
    if (destinationPlace) {
        destination = destinationPlace;
    } else {
        destination = (directions) ? directions.request.destination : document.getElementById('destination-input').value;
    }

    // Retrieve the start and end locations and create a DirectionsRequest.
    directionsService.route({
        origin: origin,
        destination: destination,
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

// TODO: this is called many times at start up & changing places. Make it once
function showSteps(directionResult, markerArray, stepDisplay, map, routeIndex) {
    // alert(routeIndex);

    // First, remove any existing markers from the map.
    removeAllMarkers(markerArray);
    map.clearOverlays;


    var icons = {
        owm_icon: {
            scaledSize: new google.maps.Size(50, 50), // scaled size
            origin: new google.maps.Point(0, 0), // origin
            anchor: new google.maps.Point(0, 0) // anchor
        },
        our_icon: {
            scaledSize: new google.maps.Size(50, 50), // scaled size
            origin: new google.maps.Point(0, 0), // origin
            anchor: new google.maps.Point(0, 0) // anchor
        }
    };

    //alert(directionResult.routes.length);
    var distanceWhenShownLastTime = 99999;
    var myRoute = directionResult.routes[routeIndex].legs[0];

    //alert(root.legs.length);
    // For each step, place a marker, and add the text to the marker's infowindow.
    // Also attach the marker to an array so we can keep track of it and remove it
    // when calculating new routes.
    showHighs(myRoute, map);

    var od_weather = new Array(myRoute.steps.length);
    var owm_weather = new Array(myRoute.steps.length);
    var weather_datapoint_cnt = 0;
    var time = new Date().getTime();
    var skipped = 0;

    for (var i = 0; i < myRoute.steps.length; i++) {
        var step = myRoute.steps[i];
        var is_the_last_step = i === myRoute.steps.length - 1;

        if ((i!==0) && (((distanceWhenShownLastTime > HOW_OFTEN_SHOW_WEATHER_DATA * ZOOMS[map.getZoom()]) || (i===1) || is_the_last_step))) {
            var location = (is_the_last_step) ? step.end_location : step.start_location;

            // collect weather data from different sources
            var promises = [];
            if (USE_NOW_CAST) {
                promises.push(getODWeather(location, od_weather, weather_datapoint_cnt, time).then(processNowCast));
            }
            if (USE_OPEN_WEATHER_MAP) {
                promises.push(getOWMWeather_viaCORS(location, owm_weather, weather_datapoint_cnt, time).then(processOpenWeatherMap));
            }
            Promise.all(promises).then(combineAndMark(location, icons, markerArray, map, time));
            weather_datapoint_cnt += 1;
            distanceWhenShownLastTime = 0;
        } else {
            // don't show weather
            distanceWhenShownLastTime = distanceWhenShownLastTime + step.distance.value;
            skipped++;
        }
        time += step.duration.value * 1000;
    }
    console.log("show", (myRoute.steps.length - skipped), "/", myRoute.steps.length, "steps");
}

function combineAndMark(latLng, icons, markerArray, map, time) {
    return function(values){
        var data = combineData(values, USE_NOW_CAST, USE_OPEN_WEATHER_MAP);
        console.log(new Date(time).toISOString(), ":", data, "mm", latLng.toString());

        var marker = new google.maps.Marker();
        markerArray.push(marker);
        marker.setPosition(latLng);
        var icon = chooseIcon(data, icons);
        marker.setIcon(icon);
        marker.setMap(map);
    }
}

// mm: mm / hour
function combineData(values, nowCast, openWeatherMap){
    var obj = {};
    var nowCastData = nowCast ? values[0] : null;
    var openWeatherMapData = openWeatherMap ? values[nowCast ? 1 : 0] : null;
    if (openWeatherMapData) {
        if(openWeatherMapData.rain && openWeatherMapData.rain["3h"]){
            obj.mmOwm = openWeatherMapData.rain["3h"] / 3;
        }
        obj.weatherIcon = openWeatherMapData.weather[0].icon;
    }
    if (nowCast) {
        if(nowCastData.mm !== null){
            obj.mm = nowCastData.mm;
        } else {
            console.log("skipped now cast");
        }
    }
    return obj;
}

var WEATHER = {
    CLEAR_SKY: "01",
    FEW_CLOUDS: "02",
    SCATTERED_CLOUDS: "03",
    BROKEN_CLOUDS: "04",
    SHOWER_RAIN: "09",
    RAIN: "10",
    THUNDERSTORM: "11",
    SNOW: "13",
    MIST: "50",
};

var ICONS = {
    SUNNY: "sunny",
    CLOUDY: "cloudy",
    RAINY1: "rainy1",
    RAINY2: "rainy2",
    RAINY3: "rainy3",
    THUNDER: "thunder",
};

function chooseIcon(data, icons) {
    var icon;
    var nowCastAvailable = data.mm != null;
    var owmWeather = data.weatherIcon ? data.weatherIcon.substr(0, 2) : null;
    if (nowCastAvailable && data.mm > 0) {
        if (data.mm <= 1) {
            icon = ICONS.RAINY1;
        } else if (data.mm <= 10) {
            icon = ICONS.RAINY2;
        } else {
            icon = ICONS.RAINY3;
        }
    } else if (owmWeather) {
        // Fallback for open weather map
        switch (owmWeather) {
            case WEATHER.CLEAR_SKY:
                icon = ICONS.SUNNY;
                break;
            case WEATHER.FEW_CLOUDS:
            case WEATHER.SCATTERED_CLOUDS:
            case WEATHER.BROKEN_CLOUDS:
                icon = ICONS.CLOUDY;
                break;
            case WEATHER.SHOWER_RAIN:
                // Trust now cast if OWM says rainy
                icon = nowCastAvailable ? ICONS.CLOUDY : ICONS.RAINY1;
                break;
            case WEATHER.RAIN:
                icon = nowCastAvailable ? ICONS.CLOUDY : ICONS.RAINY2;
                break;
            default:
                // We don't have icons
                icons.owm_icon.url = "http://openweathermap.org/img/w/" + data.weatherIcon + ".png";
                return icons.owm_icon;
        }
    }

    if (owmWeather === WEATHER.THUNDERSTORM) {
        icon = ICONS.THUNDER;
    }
    /*
    // Debug for testing icons
    var random = [ ICONS.SUNNY, ICONS.CLOUDY, ICONS.RAINY1, ICONS.RAINY2, ICONS.RAINY3, ICONS.THUNDER ];
    icon = random[parseInt(Math.random() * random.length)];
     */

    icons.our_icon.url = "/static/icons/" + icon + ".png";
    return icons.our_icon;
}

function processNowCast({data, latLng, time}) {
    if (data.error) {
        return {mm: null};
    }
    return {mm: data.pos[0].mm};
}

function processOpenWeatherMap({data, latLng, time}) {
    var nearest = getNearestForecast(data.list, time);
    console.log("nearest", new Date(nearest.dt * 1000).toISOString());
    return nearest;
}

function getNearestForecast(list, timeMillis) {
    if (list.length === 0) {
        throw "No forecast available";
    }
//    console.log("OWM data for", timeMillis, "from", list[0], "to", list[list.length - 1]);
    var nowSec = timeMillis / 1000 + OPEN_WEATHER_MAP_TIME_WINDOW_HOURS * 60 * 60 / 2;
    for (var i=list.length-1; i>=0; i--) {
        var elem = list[i];
        if (elem.dt < nowSec) {
//            console.log("OWM data chosen", elem.dt);
            return elem;
        }
    }
//    console.log("OWM data fallback to first", list[0].dt);
    return list[0];
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

function getODWeather(latLng, od_weather, i, time) {
    return new Promise(function (resolve) {
        $.ajax({
            type: 'POST',
            url: "/api",
            data: {
                unixtime: time,
                pos: [{lat: latLng.lat(), lng: latLng.lng()}]
            },
            success: function (data) {
                od_weather[i] = data;
                resolve({data, latLng, time});
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
    if ("withCredentials" in xhr) {
        // XHR for Chrome/Firefox/Opera/Safari
        xhr.open(method, url, true);
    } else if (typeof XDomainRequest !== "undefined") {
        // XDomainRequest for IE
        xhr = new XDomainRequest();
        xhr.open(method, url);
    } else {
        // CORS not supported
        xhr = null;
    }
    return xhr;
}

// Make the actual CORS request
function getOWMWeather_viaCORS(latLng, owm_weather, i, time) {
    return new Promise(function (resolve) {
        // This is a sample server that supports CORS.
        var url = 'http://api.openweathermap.org/data/2.5/forecast?lat=' + latLng.lat() + '&lon=' + latLng.lng() + '&units=metric&appid=cbcafe8bb09e522c0226c7a4b5ca05cc';
        var sampleDataUrl = "/static/openweathermap.json";

        var xhr = createCORSRequest('GET', USE_OPEN_WEATHER_MAP_SAMPLE_DATA ? sampleDataUrl : url);
        if (!xhr) {
            console.log('CORS not supported');
            return;
        }

        // Response handlers
        xhr.onload = function () {
            try {
                owm_weather[i] = xhr.responseText;
                console.log('Response from CORS request to ' + text);
                resolve({latLng, data: JSON.parse(xhr.responseText), time});
            } catch(e) {
                processErrorFromOWM(resolve, owm_weather, latLng, i, time);
            }
        };

        xhr.onerror = function () {
            processErrorFromOWM(resolve, owm_weather, latLng, i, time);
        };
        xhr.onabort = function () {
            processErrorFromOWM(resolve, owm_weather, latLng, i, time);
        };
        xhr.ontimeout = function () {
            processErrorFromOWM(resolve, owm_weather, latLng, i, time);
        };

        console.log('Request OWM for', latLng.toString());
        xhr.send();
    });
}

// it's never called
function processErrorFromOWM(resolve, owm_weather, latLng, i, time) {
    owm_weather[i] = WEATHER_DATA[i % WEATHER_DATA.length];
    resolve({latLng, data: JSON.parse(owm_weather[i]), time});
}
