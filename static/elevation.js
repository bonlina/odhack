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