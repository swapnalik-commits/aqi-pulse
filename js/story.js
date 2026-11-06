// Plain-language lines for the "What changed" panel. The page and the tests share these.

function fireStory(info, placeName) {
  if (info.error) return { kind: "error", text: "Fire data could not be loaded." };
  if (info.count === null) return { kind: "loading", text: "Loading nearby fires…" };

  let text;
  if (info.demo) {
    text = info.count
      ? "DEMO SAMPLE: " + info.count + " example fire location" +
        (info.count === 1 ? "" : "s") + " near " + placeName + "."
      : "DEMO SAMPLE: no example fires nearby.";
  } else if (info.count === 0) {
    text = "No fires nearby in the last 5 days.";
  } else {
    text = info.count + " recent fire detection" +
      (info.count === 1 ? " was" : "s were") +
      " found within about 275 km of " + placeName + ".";
  }

  if (info.sourcesFailed) {
    text += " " + info.sourcesFailed + " of " + info.sources +
      " satellite feeds did not respond, so some detections may be missing.";
  }

  return { kind: info.sourcesFailed ? "warn" : (info.count ? "ok" : "empty"), text };
}

function windStory(wind, placeName, upwindCount, fireCount) {
  if (wind.speed === null) {
    const text = wind.message || "Loading wind…";
    return { kind: text.indexOf("Could not") === 0 ? "error" : "loading", text };
  }

  let text = "Wind, this hour: blowing toward " + wind.compass + " at " + wind.speed + " km/h.";
  if (upwindCount !== null && fireCount > 0) {
    text += upwindCount === 1
      ? " 1 of the mapped fires sits roughly upwind, so smoke could be carried toward " + placeName + "."
      : upwindCount > 1
        ? " About " + upwindCount + " of the mapped fires sit roughly upwind, so smoke could be carried toward " + placeName + "."
        : " Those detections are not clearly upwind of " + placeName +
          " right now, so the wind may not be carrying that smoke toward the city.";
  }
  return { kind: "ok", text };
}

function airStory(state) {
  if (!state.ready) return { kind: "loading", text: "Loading air quality…" };
  if (state.trend) {
    const detail = typeof changeText === "function" ? " (" + changeText(state.trend.change) + ")" : "";
    return { kind: "ok", text: "Air quality: " + state.trend.label.toLowerCase() + detail + "." };
  }
  if (state.points && state.points.length) {
    return {
      kind: "ok",
      text: "Current US AQI is " + state.points[state.points.length - 1].aqi +
        ", but there is not enough hourly data to label a short-term trend."
    };
  }
  return { kind: "error", text: "Could not load air quality." };
}

if (typeof module !== "undefined") {
  module.exports = { fireStory, windStory, airStory };
}
