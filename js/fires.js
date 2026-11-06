const fireStatus = document.querySelector("#fire-status");

// Shared by map, chart, and story messages (issue #16).
function setStatus(el, kind, text) {
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
  el.classList.remove("is-loading", "is-empty", "is-error", "is-ok", "is-warn");
  if (kind) el.classList.add("is-" + kind);
}

let fireRequestCount = 0;
let windRequestCount = 0;
let mapLoaded = false;
let selectedPlace = { name: "Los Angeles", latitude: 34.05, longitude: -118.24 };
let fireFeatureCollection = { type: "FeatureCollection", features: [] };
let rawFires = [];
let firesAreDemo = false;
let selectedPlaceMarker = null;
let windMarker = null;
let windReading = { message: "Loading wind…", speed: null, direction: null };
// Shared with the "What changed" story in main.js.
let latestFireInfo = { placeName: "", count: null, demo: false, error: null, sourcesFailed: 0, sources: 3 };

function notifyStory() {
  if (typeof updateStory === "function") updateStory();
}

function reportFeed(name, state) {
  if (typeof noteFeed === "function") noteFeed(name, state);
}

function countUpwindFires() {
  if (windReading.speed === null || windReading.direction === null) return null;
  return countUpwind(rawFires, selectedPlace, windReading.direction);
}

const fireMap = new maplibregl.Map({
  container: "fire-map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [selectedPlace.longitude, selectedPlace.latitude],
  zoom: 6,
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

function emptyCollection() {
  return { type: "FeatureCollection", features: [] };
}

function paintSearchArea() {
  if (!mapLoaded) return;
  const radius = fireMap.getSource("search-area");
  if (radius) {
    radius.setData({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [circlePolygon(selectedPlace.latitude, selectedPlace.longitude, 275)]
        }
      }]
    });
  }

  const wedge = fireMap.getSource("upwind-wedge");
  if (!wedge) return;
  if (!Number.isFinite(windReading.direction)) {
    wedge.setData(emptyCollection());
    return;
  }
  wedge.setData({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [wedgePolygon(
          selectedPlace.latitude,
          selectedPlace.longitude,
          275,
          windReading.direction,
          45
        )]
      }
    }]
  });
}

function paintFires() {
  const now = Date.now();
  setFireFeatures(rawFires.map(fire => {
    const upwind = Number.isFinite(windReading.direction) && isUpwind(
      fire.latitude, fire.longitude, selectedPlace.latitude, selectedPlace.longitude, windReading.direction
    );
    const age = firesAreDemo ? 0 : ageHours(fire.detectedAt, now);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [fire.longitude, fire.latitude] },
      properties: {
        detectedAt: fire.detectedAt,
        demo: firesAreDemo ? 1 : 0,
        ageHours: age === null ? 0 : age,
        upwind: upwind ? 1 : 0
      }
    };
  }));
  paintSearchArea();
}

function updateFireLegend(demo) {
  const fireLabel = document.querySelector("#legend-fire-label");
  const ageLabel = document.querySelector("#legend-age-label");
  if (fireLabel) {
    fireLabel.textContent = demo
      ? "Example fire (not a live satellite detection)"
      : "Other fire in the last 5 days";
  }
  if (ageLabel) {
    ageLabel.textContent = demo
      ? "Example dots are not timed to today"
      : "Fainter dots are older";
  }
}

fireMap.on("load", () => {
  mapLoaded = true;
  fireMap.addSource("search-area", { type: "geojson", data: emptyCollection() });
  fireMap.addLayer({
    id: "search-radius",
    type: "line",
    source: "search-area",
    paint: {
      "line-color": "#2f5f9e",
      "line-width": 1.5,
      "line-dasharray": [2, 2],
      "line-opacity": 0.8
    }
  });

  fireMap.addSource("upwind-wedge", { type: "geojson", data: emptyCollection() });
  fireMap.addLayer({
    id: "upwind-fill",
    type: "fill",
    source: "upwind-wedge",
    paint: {
      "fill-color": "#c2410c",
      "fill-opacity": 0.14
    }
  });

  fireMap.addSource("fire-detections", { type: "geojson", data: fireFeatureCollection });
  fireMap.addLayer({
    id: "fire-dots",
    type: "circle",
    source: "fire-detections",
    paint: {
      "circle-radius": ["case", ["==", ["get", "upwind"], 1], 8, 5],
      "circle-color": ["case", ["==", ["get", "upwind"], 1], "#c2410c", "#fdba74"],
      "circle-opacity": [
        "case",
        ["==", ["get", "demo"], 1],
        0.95,
        ["interpolate", ["linear"], ["coalesce", ["get", "ageHours"], 0], 0, 1, 120, 0.35]
      ],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5
    }
  });

  fireMap.on("click", "fire-dots", event => {
    const fire = event.features[0];
    const content = document.createElement("div");
    const when = new Date(fire.properties.detectedAt).toLocaleString([], {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short"
    });
    const isDemo = Number(fire.properties.demo) === 1;
    let text = isDemo ? "Sample time (not live): " + when : "Detected " + when;
    if (!isDemo) {
      const age = Number(fire.properties.ageHours);
      text += age < 1 ? " (under 1 hour ago)" : " (" + Math.round(age) + " hours ago)";
    }
    if (Number(fire.properties.upwind) === 1) text += ". Roughly upwind.";
    content.textContent = text;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setDOMContent(content)
      .addTo(fireMap);
  });

  fireMap.on("mouseenter", "fire-dots", () => { fireMap.getCanvas().style.cursor = "pointer"; });
  fireMap.on("mouseleave", "fire-dots", () => { fireMap.getCanvas().style.cursor = ""; });
  setPlaceMarker();
  renderWindMarker();
  paintFires();
  fireMap.resize();
});

function renderWindMarker() {
  if (!mapLoaded) return;
  if (windMarker) windMarker.remove();

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
  windReading = { message: "Loading wind…", speed: null, direction: null };
  renderWindMarker();
  paintSearchArea();

  const query = new URLSearchParams({
    latitude,
    longitude,
    current: "wind_speed_10m,wind_direction_10m",
    wind_speed_unit: "kmh"
  });

  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?" + query,
      { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    if (thisRequest !== windRequestCount) return;

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
    paintFires();
    notifyStory();
    reportFeed("wind", "ok");
  } catch (error) {
    if (thisRequest !== windRequestCount) return;
    windReading = { message: "Could not load wind. Try Refresh.", speed: null, direction: null };
    renderWindMarker();
    paintSearchArea();
    notifyStory();
    reportFeed("wind", "error");
  }
}

async function showFires(coords, placeName) {
  const [latitude, longitude] = coords.split(",").map(Number);
  const thisRequest = ++fireRequestCount;
  selectedPlace = { name: placeName, latitude, longitude };
  rawFires = [];
  firesAreDemo = false;
  latestFireInfo = { placeName: placeName, count: null, demo: false, error: null, sourcesFailed: 0, sources: 3 };
  renderWindMarker();
  fireMap.easeTo({ center: [longitude, latitude], zoom: 6 });
  setPlaceMarker();
  paintFires();
  setStatus(fireStatus, "loading", "Loading fires near " + placeName + "…");
  notifyStory();

  if (window.location.protocol === "file:") {
    setStatus(fireStatus, "error", "Could not load fires. Open http://127.0.0.1:8000/ with py server.py running.");
    latestFireInfo.error = "Open the page through the local server to load fires.";
    notifyStory();
    reportFeed("fires", "error");
    return;
  }

  try {
    const response = await fetch("/api/fires?latitude=" + latitude + "&longitude=" + longitude,
      { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Local FIRMS request failed (HTTP " + response.status + ").");
    }
    const result = await response.json();
    if (thisRequest !== fireRequestCount) return;
    if (!Array.isArray(result.fires)) throw new Error("Fire data had an unexpected format.");

    firesAreDemo = Boolean(result.demo);
    rawFires = dedupeFires(result.fires);
    paintFires();
    updateFireLegend(firesAreDemo);

    const count = rawFires.length;
    const sourcesFailed = Number(result.sourcesFailed) || 0;
    const sources = Number(result.sources) || 3;
    latestFireInfo = {
      placeName: placeName,
      count: count,
      demo: firesAreDemo,
      error: null,
      sourcesFailed: sourcesFailed,
      sources: sources
    };

    let text;
    let kind;
    if (firesAreDemo) {
      kind = count ? "ok" : "empty";
      text = count
        ? "DEMO SAMPLE: " + count + " example fire location" + (count === 1 ? "" : "s") +
          " near " + placeName + " (not live)."
        : "DEMO SAMPLE: no example fires nearby.";
    } else if (count === 0) {
      kind = "empty";
      text = "No fires nearby in the last 5 days.";
    } else {
      kind = "ok";
      text = count + " recent fire detection" + (count === 1 ? "" : "s") +
        " within about 275 km of " + placeName +
        ". Darker dots are upwind. Fainter dots are older. FIRMS dots are hotspots, not confirmed fire perimeters.";
    }
    if (sourcesFailed) {
      kind = "warn";
      text += " " + sourcesFailed + " of " + sources +
        " satellite feeds did not respond, so some detections may be missing.";
    }
    setStatus(fireStatus, kind, text);
    notifyStory();
    reportFeed("fires", sourcesFailed ? "partial" : "ok");
  } catch (error) {
    if (thisRequest !== fireRequestCount) return;
    setStatus(fireStatus, "error", "Could not load fire data. Try Refresh.");
    latestFireInfo = {
      placeName: placeName,
      count: null,
      demo: false,
      error: error.message,
      sourcesFailed: 0,
      sources: 3
    };
    notifyStory();
    reportFeed("fires", "error");
  }
}
