function initMap() {
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


    new AutocompleteDirectionsHandler(map, directionsDisplay, directionsService, markerArray, stepDisplay);
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
        region: 'ja',
        unitSystem: google.maps.UnitSystem.METRIC,
        transitOptions: {
            //arrivalTime: Date,
            departureTime: new Date(Date.now() + 1000),  // for the time N milliseconds from now.
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
        url: "https://lh5.googleusercontent.com/_3TrhfHItLZzJlpYsQDvYvh_lDq0DoIrYPT3oIExtoy6f1BT9s5dj-6FbV3_sjFtgNqajhIMgAQUomo=w2560-h1452",
        scaledSize: new google.maps.Size(50, 50), // scaled size
        origin: new google.maps.Point(0, 0), // origin
        anchor: new google.maps.Point(0, 0) // anchor
    };

    var sun_under_cloud_and_rain = {
        url: "http://profigrupp-izh.ru/images/pattern.png?crc=3972484510",
        scaledSize: new google.maps.Size(50, 50), // scaled size
        origin: new google.maps.Point(0, 0), // origin
        anchor: new google.maps.Point(0, 0) // anchor
    };

    var heavy_rain = {
        url: "https://lh3.googleusercontent.com/KTDAIa7D-5zra-bd2riC2PaOR69WA4E8IrAwtM0Z1Mwuhq_z5nTaYJVMZD3dSVofrjm_wnlalXDFDpg=w2560-h1452",
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

    for (var i = 0; i < myRoute.steps.length; i++) {

        var step = myRoute.steps[i];
        var start_location = step.start_location;

        if ((i!=0) && ((distanceWhenShownLastTime > (400 * map.getZoom()) || (i==1) || (i == myRoute.steps.length-2)))) {
            // show weather
            mm = 0;
            getWeather(start_location, function(start_location, markerArray, i) {
                    return function(data) {
                        mm = data.pos[0].mm;
                        var marker = new google.maps.Marker;
                        markerArray.push(marker);
                        marker.setPosition(start_location);
                        if (mm == 0) {
                            marker.setIcon(sun);
                        } else if (mm == 1) {
                            marker.setIcon(sun_under_cloud_and_rain);
                        } else {
                            marker.setIcon(heavy_rain);
                        }
                        marker.setMap(map);
                        attachInstructionText(stepDisplay, marker, myRoute.steps[i].instructions, map);
                    }
                }(start_location, markerArray, i)
            );
            distanceWhenShownLastTime = 0;
        } else {
            // don't show weather
            distanceWhenShownLastTime = distanceWhenShownLastTime + step.distance.value;
        }

    }
}

function showHighs(route, map) {
    // Create an ElevationService.
    var elevator = new google.maps.ElevationService;

    var path = [];

    for (var i = 0; i < route.steps.length; i++) {
        var step = route.steps[i];
        path.push(step.start_location);
    }
    path.push(step.end_location);

    // Draw the path, using the Visualization API and the Elevation service.
    displayPathElevation(path, elevator, map);
}

function displayPathElevation(path, elevator, map) {
    // Display a polyline of the elevation path.
    new google.maps.Polyline({
        path: path,
        strokeColor: '#0000CC',
        strokeOpacity: 0.4,
        map: null
    });

    // Create a PathElevationRequest object using this array.
    // Ask for 256 samples along that path.
    // Initiate the path request.
    elevator.getElevationAlongPath({
        'path': path,
        'samples': 256
    }, plotElevation);
}

// Takes an array of ElevationResult objects, draws the path on the map
// and plots the elevation profile on a Visualization API ColumnChart.
function plotElevation(elevations, status) {
    var chartDiv = document.getElementById('elevation_chart');
    if (status !== 'OK') {
        // Show the error code inside the chartDiv.
        chartDiv.innerHTML = 'Cannot show elevation: request failed because ' +
            status;
        return;
    }
    // Create a new chart in the elevation_chart DIV.
    var chart = new google.visualization.ColumnChart(chartDiv);

    // Extract the data from which to populate the chart.
    // Because the samples are equidistant, the 'Sample'
    // column here does double duty as distance along the
    // X axis.
    var data = new google.visualization.DataTable();
    data.addColumn('string', 'Sample');
    data.addColumn('number', 'Elevation');
    for (var i = 0; i < elevations.length; i++) {
        data.addRow(['', elevations[i].elevation]);
    }

    // Draw the chart using the data within its DIV.
    chart.draw(data, {
        height: 150,
        legend: 'none',
        titleY: 'Elevation (m)'
    });
}

function attachInstructionText(stepDisplay, marker, text, map) {
    google.maps.event.addListener(marker, 'click', function() {
        // Open an info window when the marker is clicked on, containing the text
        // of the step.
        stepDisplay.setContent(text);
        stepDisplay.open(map, marker);
    });
}


function AutocompleteDirectionsHandler(map, directionsDisplay, directionsService, markerArray, stepDisplay) {
    this.map = map;
    this.originPlaceId = null;
    this.destinationPlaceId = null;
    this.travelMode = 'WALKING';
    var originInput = document.getElementById('origin-input');
    var destinationInput = document.getElementById('destination-input');
    var modeSelector = document.getElementById('mode-selector');
    this.directionsService = new google.maps.DirectionsService;
    this.directionsDisplay = new google.maps.DirectionsRenderer;
    this.directionsDisplay.setMap(map);

    var originAutocomplete = new google.maps.places.Autocomplete(originInput, {placeIdOnly: true});
    var destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, {placeIdOnly: true});
    this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(destinationInput);                                                                                                                                   this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(modeSelector);
}

// Sets a listener on a radio button to change the filter type on Places
// Autocomplete.
AutocompleteDirectionsHandler.prototype.setupClickListener = function(id, mode, directionsDisplay, directionsService, markerArray, stepDisplay, map) {
    var radioButton = document.getElementById(id);
    var me = this;
    document.getElementById('mode').value = mode;
    radioButton.addEventListener('click', function() {
        me.travelMode = mode;
        calculateAndDisplayRoute(directionsDisplay, directionsService, markerArray, stepDisplay, map);
    });
};

AutocompleteDirectionsHandler.prototype.setupPlaceChangedListener = function(autocomplete, mode, directionsDisplay, directionsService, markerArray, stepDisplay, map) {
    var me = this;
    autocomplete.bindTo('bounds', this.map);
    autocomplete.addListener('place_changed', function() {
        var place = autocomplete.getPlace();
        if (!place.place_id) {
            window.alert("Please select an option from the dropdown list.");
            return;
        }
        if (mode === 'ORIG') {
            me.originPlaceId = place.place_id;
        } else {
            me.destinationPlaceId = place.place_id;
        }
        calculateAndDisplayRoute(directionsDisplay, directionsService, markerArray, stepDisplay, map);
    });

};

function getWeather(latLng, callback) {
    $.ajax({
        type: 'POST',
        url: "/api",
        data: {
            unixtime: new Date().getTime(),
            // unixtime: new Date("2017-08-06T09:40+0900").getTime(),
            pos: [{lat: latLng.lat(), lng: latLng.lng()}]
        },
        success: function (data) {
            callback(data);
            console.log("Got " + data.length + " results");
            data.pos.forEach(function (data) { console.log(data); });
        },
        dataType: "json"
    });
}
