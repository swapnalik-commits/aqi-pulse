const fireStatus = document.querySelector("#fire-status");
let fireRequestCount = 0;
let mapLoaded = false;
let selectedPlace = { name: "Los Angeles", latitude: 34.05, longitude: -118.24 };
let fireFeatureCollection = { type: "FeatureCollection", features: [] };
let selectedPlaceMarker = null;

const fireMap = new maplibregl.Map({
  container: "fire-map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [selectedPlace.longitude, selectedPlace.latitude],
  zoom: 7,
  attributionControl: true
});

fireMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

function setPlaceMarker() {
  if (!mapLoaded) return;
  if (selectedPlaceMarker) selectedPlaceMarker.remove();
  selectedPlaceMarker = new maplibregl.Marker({ color: "#2f5f9e" })
    .setLngLat([selectedPlace.longitude, selectedPlace.latitude])
    .setPopup(new maplibregl.Popup({ offset: 25 }).setText(selectedPlace.name))
    .addTo(fireMap);
}

function setFireFeatures(features) {
  fireFeatureCollection = { type: "FeatureCollection", features };
  const source = fireMap.getSource("fire-detections");
  if (source) source.setData(fireFeatureCollection);
}

fireMap.on("load", () => {
  mapLoaded = true;
  fireMap.addSource("fire-detections", { type: "geojson", data: fireFeatureCollection });
  fireMap.addLayer({
    id: "fire-dots",
    type: "circle",
    source: "fire-detections",
    paint: {
      "circle-radius": 6,
      "circle-color": "#f07824",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5
    }
  });
  fireMap.on("click", "fire-dots", event => {
    const fire = event.features[0];
    const content = document.createElement("div");
    content.textContent = "Detected " + new Date(fire.properties.detectedAt).toLocaleString([], {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short"
    });
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setDOMContent(content)
      .addTo(fireMap);
  });
  fireMap.on("mouseenter", "fire-dots", () => { fireMap.getCanvas().style.cursor = "pointer"; });
  fireMap.on("mouseleave", "fire-dots", () => { fireMap.getCanvas().style.cursor = ""; });
  setPlaceMarker();
  fireMap.resize();
});

async function showFires(coords, placeName) {
  const [latitude, longitude] = coords.split(",").map(Number);
  const thisRequest = ++fireRequestCount;
  selectedPlace = { name: placeName, latitude, longitude };
  fireMap.easeTo({ center: [longitude, latitude], zoom: 7 });
  setPlaceMarker();
  setFireFeatures([]);
  fireStatus.textContent = "Loading recent NASA FIRMS detections near " + placeName + "…";

  if (window.location.protocol === "file:") {
    fireStatus.textContent = "Start the local app with python server.py, then open http://127.0.0.1:8000.";
    return;
  }

  try {
    const response = await fetch("/api/fires?latitude=" + latitude + "&longitude=" + longitude,
      { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Local FIRMS request failed (HTTP " + response.status + ").");
    }
    const detections = await response.json();
    if (thisRequest !== fireRequestCount) return;

    setFireFeatures(detections.map(fire => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [fire.longitude, fire.latitude] },
      properties: { detectedAt: fire.detectedAt }
    })));

    const count = detections.length;
    fireStatus.textContent = count
      ? count + " recent fire detection" + (count === 1 ? "" : "s") +
        " within about 275 km of " + placeName + ". FIRMS satellite detections are hotspots, not confirmed fire perimeters."
      : "No recent NASA FIRMS detections found near " + placeName + ".";
  } catch (error) {
    if (thisRequest !== fireRequestCount) return;
    fireStatus.textContent = "Could not load fire detections for " + placeName + " (" + error.message + ").";
  }
}
