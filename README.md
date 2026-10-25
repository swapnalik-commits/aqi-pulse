# aqi-pulse
Live air-quality and wildfire visualization: fires, wind, and how the air is changing

## Run the page

Run the local server from PowerShell:

```text
python server.py
```

Then open <http://127.0.0.1:8000/>. The server reads `MAP_KEY` from `.env` and proxies FIRMS requests, so the key stays out of browser code and the page must be opened through the local server (instead of `index.html` as a `file://` URL.) The `MAP_KEY` which gives us the location coordinates of the fire spots can be obtained from the [NASA FIRMS API page](https://firms.modaps.eosdis.nasa.gov/api).

The map shows the selected place, current wind, and recent detections from the three VIIRS near-real-time satellite feeds within roughly 275 km. The wind arrow points downwind and is labeled with speed in km/h; fire markers show acquisition time when selected. The basemap uses OpenFreeMap, which requires no API key and provides OpenStreetMap attribution.
