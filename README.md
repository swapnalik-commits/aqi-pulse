# aqi-pulse
Live air-quality and wildfire visualization: fires, wind, and how the air is changing

## Run the page

Run the local server from PowerShell:

```text
python server.py
```

Then open <http://127.0.0.1:8000/>. Use the local server rather than opening `index.html` as a `file://` URL.

### Running without a NASA FIRMS key

No `.env` file or API key is needed to preview the project. Without a key, the app shows built-in example fire locations and timestamps so the map can be explored. They are clearly labeled **DEMO SAMPLE** and are fictional examples, not real or live satellite detections. Wind, air quality, and map tiles still load from their respective online services.

### Enabling live NASA FIRMS data

Request a `MAP_KEY` from the [NASA FIRMS API page](https://firms.modaps.eosdis.nasa.gov/api), then create a `.env` file in the project root with:

```text
MAP_KEY=your_key_here
```

Restart `python server.py`. The server reads the key from `.env` and proxies FIRMS requests, keeping the key out of browser code. `.env` is Git-ignored.

The map shows the selected place, current wind, and recent detections from the three VIIRS near-real-time satellite feeds within roughly 275 km. The wind arrow points downwind and is labeled with speed in km/h; fire markers show acquisition time when selected. The basemap uses OpenFreeMap, which requires no API key and provides OpenStreetMap attribution.
