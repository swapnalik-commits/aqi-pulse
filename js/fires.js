const fireStatus = document.querySelector("#fire-status");
let fireRequestCount = 0;
let windRequestCount = 0;
let mapLoaded = false;
let selectedPlace = { name: "Los Angeles", latitude: 34.05, longitude: -118.24 };
let fireFeatureCollection = { type: "FeatureCollection", features: [] };
let selectedPlaceMarker = null;
let windMarker = null;
let windReading = { message: "Loading wind...", speed: null, direction: null };

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
  renderWindMarker();
  fireMap.resize();
});

function renderWindMarker() {
  if (!mapLoaded)
    return;
  if (windMarker)
    windMarker.remove();

  const element = document.createElement("div");
  element.className = "wind-marker";
  element.setAttribute("role", "status");

  if (windReading.speed === null) {
    element.textContent = windReading.message;
  } else {
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("class", "wind-arrow");
    arrow.setAttribute("viewBox", "0 0 24 24");
    arrow.setAttribute("aria-hidden", "true");

    const arrowShape = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowShape.setAttribute("d", "M12 2 22 22 12 17 2 22Z");
    arrow.appendChild(arrowShape);
    arrow.style.transform = "rotate(" + windReading.direction + "deg)";

    const text = document.createElement("span");
    text.className = "wind-copy";

    const direction = document.createElement("strong");
    direction.textContent = "Wind toward " + windReading.compass;

    const speed = document.createElement("span");
    speed.textContent = windReading.speed + " km/h";

    text.append(direction, speed);
    element.append(arrow, text);
    element.setAttribute("aria-label", "Wind blowing toward " + windReading.compass +
      " at " + windReading.speed + " kilometers per hour");
  }

  windMarker = new maplibregl.Marker({ element, anchor: "left", offset: [12, 0] })
    .setLngLat([selectedPlace.longitude, selectedPlace.latitude])
    .addTo(fireMap);
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

async function loadWind(coords, placeName) {
  const [latitude, longitude] = coords.split(",").map(Number);
  const thisRequest = ++windRequestCount;
  windReading = { message: "Loading wind...", speed: null, direction: null };
  renderWindMarker();

  const query = new URLSearchParams({
    latitude,
    longitude,
    current: "wind_speed_10m,wind_direction_10m",
    wind_speed_unit: "kmh"
  });

  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?" + query,
      { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();
    if (thisRequest !== windRequestCount) {
      return;
    }

    const rawSpeed = data.current?.wind_speed_10m;
    const rawDirection = data.current?.wind_direction_10m;
    if (rawSpeed === null || rawSpeed === undefined || rawDirection === null || rawDirection === undefined) {
      throw new Error("wind data is unavailable");
    }

    const speed = Number(rawSpeed);
    const directionFrom = Number(rawDirection);
    if (!Number.isFinite(speed) || !Number.isFinite(directionFrom)) {
      throw new Error("wind data is unavailable");
    }

    const direction = (directionFrom + 180) % 360;
    windReading = {
      speed: Math.round(speed * 10) / 10,
      direction,
      compass: COMPASS_POINTS[Math.round(direction / 45) % 8]
    };

    renderWindMarker();
  } catch (error) {
    if (thisRequest !== windRequestCount) return;
    windReading = { message: "Wind unavailable for " + placeName, speed: null, direction: null };
    renderWindMarker();
  }
}

async function showFires(coords, placeName) {
  const [latitude, longitude] = coords.split(",").map(Number);
  const thisRequest = ++fireRequestCount;
  selectedPlace = { name: placeName, latitude, longitude };
  renderWindMarker();
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
