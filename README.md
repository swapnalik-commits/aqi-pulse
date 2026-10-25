# aqi-pulse
Live air-quality and wildfire visualization: fires, wind, and how the air is changing

## Run the page

Run the local server from PowerShell:

```text
python server.py
```

Then open <http://127.0.0.1:8000/>. The server reads `MAP_KEY` from `.env` and proxies FIRMS requests, so the key stays out of browser code and the page must be opened through the local server (instead of `index.html` as a `file://` URL.) The `MAP_KEY` can be obtained from the [NASA FIRMS API page](https://firms.modaps.eosdis.nasa.gov/api).

The map shows the selected place and recent detections from the three VIIRS near-real-time satellite feeds within roughly 275 km. Select a fire marker to see its acquisition time (shown in the browser's local time, with its timezone). The basemap uses OpenFreeMap, which requires no API key and provides OpenStreetMap attribution.
