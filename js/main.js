const placeSelect = document.querySelector("#place");
const refreshBtn = document.querySelector("#refresh");
const chartStatus = document.querySelector("#chart p");
const storyBox = document.querySelector("#story");

const chartBox = document.querySelector("#aqi-chart");
const trendBox = document.querySelector("#trend");
const adviceBox = document.querySelector("#advice");
const skyBand = document.querySelector("#now");
const nowTitle = document.querySelector("#now-title");
const nowAqi = document.querySelector("#now-aqi");
const updatedBox = document.querySelector("#updated");

// Latest trend for the selected place (the "What changed" text can reuse it).
let currentTrend = null;
let lastPoints = null;
let lastPlaceName = "";
let airReady = false;

// US EPA AQI levels: used for the chart bands and the health message.
const AQI_LEVELS = [
  { max: 50, name: "Good", color: "#00e400",
    advice: "Air quality is satisfactory. Outdoor activity is fine for everyone." },
  { max: 100, name: "Moderate", color: "#ffff00",
    advice: "Acceptable for most people. People who are unusually sensitive to air pollution should consider shorter or lighter outdoor activity." },
  { max: 150, name: "Unhealthy for sensitive groups", color: "#ff7e00",
    advice: "Children, older adults, and people with asthma or heart or lung disease should reduce long or heavy outdoor activity." },
  { max: 200, name: "Unhealthy", color: "#ff0000",
    advice: "Everyone may begin to feel effects. Sensitive groups should avoid long or heavy outdoor activity; everyone else should cut back." },
  { max: 300, name: "Very unhealthy", color: "#8f3f97",
    advice: "Health alert: everyone is at higher risk. Avoid long or heavy outdoor activity." },
  { max: 500, name: "Hazardous", color: "#7e0023",
    advice: "Health warning: everyone should avoid outdoor activity and stay indoors where possible." }
];

function levelFor(aqi) {
  return AQI_LEVELS.find(level => aqi <= level.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

// Used to ignore a slow response if the user has already picked another place.
let requestCount = 0;

function markUpdated() {
  updatedBox.textContent = "Updated " + new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  }) + " (your time).";
}

function hoursLabel(n) {
  if (typeof hoursText === "function") return hoursText(n);
  return n === 1 ? "1 hour" : n + " hours";
}

// Plain-language summary for issue #8.
function updateStory() {
  const placeName = lastPlaceName || placeSelect.selectedOptions[0].textContent;
  const parts = [];

  if (latestFireInfo.error) {
    parts.push("Fire detections could not be loaded for " + placeName + ".");
  } else if (latestFireInfo.count === null) {
    parts.push("Loading nearby fire detections for " + placeName + "…");
  } else if (latestFireInfo.demo) {
    parts.push(
      latestFireInfo.count
        ? "DEMO SAMPLE: " + latestFireInfo.count + " example fire location" +
          (latestFireInfo.count === 1 ? "" : "s") + " near " + placeName +
          " (not live satellite detections)."
        : "DEMO SAMPLE: no example fires near " + placeName + "."
    );
  } else if (latestFireInfo.count === 0) {
    parts.push("No recent NASA FIRMS fire detections were found near " + placeName + ".");
  } else {
    parts.push(
      latestFireInfo.count + " recent fire detection" +
      (latestFireInfo.count === 1 ? " was" : "s were") +
      " found within about 275 km of " + placeName + "."
    );
  }

  if (windReading.speed === null) {
    parts.push(windReading.message || "Wind is still loading.");
  } else {
    let windLine = "The wind is blowing toward " + windReading.compass +
      " at " + windReading.speed + " km/h.";
    const upwind = countUpwindFires();
    if (upwind !== null && latestFireInfo.count > 0) {
      windLine += upwind > 0
        ? " About " + upwind + " of the mapped fire" + (upwind === 1 ? "" : "s") +
          " sit roughly upwind, so smoke could be carried toward " + placeName + "."
        : " Those detections are not clearly upwind of " + placeName +
          " right now, so the wind may not be carrying that smoke toward the city.";
    }
    parts.push(windLine);
  }

  if (!airReady) {
    parts.push("Air quality is still loading.");
  } else if (currentTrend) {
    const sign = currentTrend.change > 0 ? "+" : "";
    parts.push(
      "Air quality is " + currentTrend.label.toLowerCase() +
      " (" + sign + currentTrend.change + " AQI in the last " +
      hoursLabel(TREND_RULE.hours) + ")."
    );
  } else if (lastPoints && lastPoints.length) {
    parts.push(
      "Current US AQI is " + lastPoints[lastPoints.length - 1].aqi +
      ", but there is not enough hourly data to label a short-term trend."
    );
  } else {
    parts.push("Air quality data is unavailable right now.");
  }

  storyBox.textContent = parts.join(" ");
}

function showPlace() {
  const placeName = placeSelect.selectedOptions[0].textContent;
  lastPlaceName = placeName;
  airReady = false;
  currentTrend = null;
  lastPoints = null;
  updatedBox.textContent = "Refreshing…";
  if (refreshBtn) refreshBtn.disabled = true;
  showFires(placeSelect.value, placeName);
  loadWind(placeSelect.value, placeName);
  loadAirQuality(placeSelect.value, placeName).finally(function () {
    if (refreshBtn) refreshBtn.disabled = false;
    markUpdated();
    updateStory();
  });
  updateStory();
}

// Get hourly US AQI from Open-Meteo (free, no API key).
async function loadAirQuality(coords, placeName) {
  const [lat, lon] = coords.split(",");
  const thisRequest = ++requestCount;

  chartStatus.textContent = "Loading air quality for " + placeName + "…";
  nowTitle.textContent = "Checking the air in " + placeName + "…";
  nowAqi.hidden = true;
  skyBand.style.removeProperty("--level");
  chartStatus.hidden = false;
  trendBox.hidden = true;
  adviceBox.hidden = true;
  chartBox.replaceChildren();
  currentTrend = null;
  lastPoints = null;
  airReady = false;
  updateStory();

  const url = "https://air-quality-api.open-meteo.com/v1/air-quality" +
    "?latitude=" + lat + "&longitude=" + lon +
    "&hourly=us_aqi&past_days=1&forecast_days=1" +
    "&timezone=auto&timeformat=unixtime";

  try {
    // give up after 10 seconds instead of showing "Loading…" forever
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (thisRequest !== requestCount) return;

    // The API also sends forecast hours, so keep past hours only (last 24).
    const nowSeconds = Date.now() / 1000;
    const offset = data.utc_offset_seconds;
    const points = data.hourly.time
      .map((t, i) => ({ t, aqi: data.hourly.us_aqi[i] }))
      .filter(p => p.t <= nowSeconds && p.aqi !== null)
      .slice(-24)
      // Convert to the place's local time.
      .map(p => ({ time: new Date((p.t + offset) * 1000), aqi: p.aqi }));

    if (points.length < 2) {
      chartStatus.textContent = "No recent air-quality data for " + placeName + ".";
      nowTitle.textContent = "No recent air-quality data for " + placeName + ".";
      airReady = true;
      updateStory();
      return;
    }

    chartStatus.hidden = true;
    currentTrend = trendFor(points);
    lastPoints = points;
    airReady = true;
    drawChart(points, currentTrend);
    showTrend();
    showNow(points[points.length - 1], placeName);
    updateStory();
  } catch (error) {
    if (thisRequest !== requestCount) return;
    const reason = error.name === "TimeoutError" ? "the request timed out" : error.message;
    chartStatus.textContent = "Could not load air quality for " + placeName +
      " (" + reason + "). Try again in a minute.";
    nowTitle.textContent = "Couldn't load air quality for " + placeName + ". Try again in a minute.";
    airReady = true;
    updateStory();
  }
}

// Only show a trend if the two readings are exactly TREND_RULE.hours apart
// (if an hour is missing, the comparison would be wrong).
function trendFor(points) {
  const trend = getTrend(points.map(p => p.aqi));
  if (!trend) return null;
  const start = points[points.length - 1 - TREND_RULE.hours];
  const end = points[points.length - 1];
  const hoursApart = (end.time - start.time) / 3600000;
  if (hoursApart !== TREND_RULE.hours) return null;
  return { ...trend, start, end };
}

// Line chart of the last 24 hours.
function drawChart(points, trend) {
  // draw at the real on-screen width so text stays readable on phones
  const width = Math.max(300, Math.round(chartBox.clientWidth || 720));
  const height = width < 520 ? 260 : 320;
  const margin = { top: 16, right: 24, bottom: 36, left: 56 };

  const highest = d3.max(points, p => p.aqi);
  const topOfChart = Math.max(100, Math.ceil((highest + 10) / 50) * 50);

  const x = d3.scaleUtc()
    .domain(d3.extent(points, p => p.time))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, topOfChart])
    .range([height - margin.bottom, margin.top]);

  chartBox.replaceChildren();
  const svg = d3.select(chartBox)
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", "Line chart of hourly US AQI over the last 24 hours. Latest value: " +
      points[points.length - 1].aqi + ".");

  // AQI level bands behind the line.
  let bottom = 0;
  AQI_LEVELS.forEach(level => {
    const bandTop = Math.min(level.max, topOfChart);
    if (bottom < topOfChart) {
      svg.append("rect")
        .attr("x", margin.left)
        .attr("width", width - margin.left - margin.right)
        .attr("y", y(bandTop))
        .attr("height", y(bottom) - y(bandTop))
        .attr("fill", level.color)
        .attr("opacity", 0.12);
      svg.append("text")
        .attr("class", "band-label")
        .attr("x", margin.left + 6)
        .attr("y", y(bandTop) + 13)
        .attr("text-anchor", "start")
        .text(level.name);
    }
    bottom = level.max;
  });

  // Shade the hours the trend label compares.
  if (trend) {
    const { start, end } = trend;
    svg.append("rect")
      .attr("class", "trend-window")
      .attr("x", x(start.time))
      .attr("width", x(end.time) - x(start.time))
      .attr("y", margin.top)
      .attr("height", height - margin.top - margin.bottom);
    svg.append("text")
      .attr("class", "trend-window-label")
      .attr("x", (x(start.time) + x(end.time)) / 2)
      .attr("y", height - margin.bottom - 6)
      .attr("text-anchor", "middle")
      .text("last " + TREND_RULE.hours + " h");
  }

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x).ticks(width < 520 ? 4 : 6).tickFormat(d3.utcFormat("%-I %p")));

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).ticks(5));

  svg.append("text")
    .attr("class", "axis-title")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
    .attr("y", 14)
    .attr("text-anchor", "middle")
    .text("US AQI");

  const line = d3.line()
    .x(p => x(p.time))
    .y(p => y(p.aqi));

  svg.append("path")
    .datum(points)
    .attr("class", "aqi-line")
    .attr("d", line);

  // Dots with a tooltip showing the exact value.
  svg.selectAll(".aqi-dot")
    .data(points)
    .join("circle")
    .attr("class", "aqi-dot")
    .attr("cx", p => x(p.time))
    .attr("cy", p => y(p.aqi))
    .attr("r", 3)
    .append("title")
    .text(p => d3.utcFormat("%b %-d, %-I %p")(p.time) + ": AQI " + p.aqi);

  // Hollow dot marks the earlier reading used for the trend.
  if (trend) {
    svg.append("circle")
      .attr("class", "trend-start")
      .attr("cx", x(trend.start.time))
      .attr("cy", y(trend.start.aqi))
      .attr("r", 5)
      .append("title")
      .text(TREND_RULE.hours + " hours ago: AQI " + trend.start.aqi);
  }

  // "Now" label on the latest point.
  const last = points[points.length - 1];
  svg.append("text")
    .attr("class", "now-label")
    .attr("x", x(last.time) - 6)
    // move it below the point if it would go off the top
    .attr("y", y(last.aqi) < margin.top + 20 ? y(last.aqi) + 20 : y(last.aqi) - 10)
    .attr("text-anchor", "end")
    .text("Now: " + last.aqi);
}

// Trend badge (rule is in js/trend.js).
function showTrend() {
  if (!currentTrend) return;

  const sign = currentTrend.change > 0 ? "+" : "";
  const detail = document.createElement("small");
  detail.textContent = "(" + sign + currentTrend.change + " AQI in the last " + hoursLabel(TREND_RULE.hours) + ")";

  trendBox.style.background = TREND_COLORS[currentTrend.label];
  trendBox.replaceChildren(TREND_ARROWS[currentTrend.label] + " " + currentTrend.label, detail);
  trendBox.hidden = false;
}

// Top band: headline, current AQI, health message, and the level color.
function showNow(latest, placeName) {
  const level = levelFor(latest.aqi);
  skyBand.style.setProperty("--level", level.color);
  nowTitle.textContent = "The air in " + placeName + " is " + level.name.toLowerCase() + " right now.";

  const value = document.createElement("strong");
  value.textContent = latest.aqi;
  nowAqi.replaceChildren(value, "US AQI");
  nowAqi.hidden = false;

  adviceBox.textContent = level.advice;
  adviceBox.hidden = false;
}

// Redraw the chart when the window size changes.
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (lastPoints) drawChart(lastPoints, currentTrend);
  }, 150);
});

placeSelect.addEventListener("change", showPlace);
if (refreshBtn) refreshBtn.addEventListener("click", showPlace);
showPlace();
