const placeSelect = document.querySelector("#place");
const sections = [
  document.querySelector("#map p"),
  document.querySelector("#chart p"),
  document.querySelector("#summary p")
];

const chartBox = document.querySelector("#aqi-chart");
const adviceBox = document.querySelector("#advice");
const updatedBox = document.querySelector("#updated");

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

function showPlace() {
  const placeName = placeSelect.selectedOptions[0].textContent;
  sections[0].textContent = "Fires for " + placeName + " will appear here.";
  sections[2].textContent = "Trend for " + placeName + " will appear here.";
  loadAirQuality(placeSelect.value, placeName);
}

// Get hourly US AQI from Open-Meteo (free, no API key).
async function loadAirQuality(coords, placeName) {
  const [lat, lon] = coords.split(",");
  const thisRequest = ++requestCount;

  sections[1].textContent = "Loading air quality for " + placeName + "...";
  sections[1].hidden = false;
  adviceBox.hidden = true;
  updatedBox.textContent = "";
  chartBox.replaceChildren();

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
      sections[1].textContent = "No recent air-quality data for " + placeName + ".";
      return;
    }

    sections[1].hidden = true;
    drawChart(points);
    showAdvice(points[points.length - 1]);
    updatedBox.textContent = "Last updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " (your time).";
  } catch (error) {
    if (thisRequest !== requestCount) return;
    const reason = error.name === "TimeoutError" ? "the request timed out" : error.message;
    sections[1].textContent = "Could not load air quality for " + placeName +
      " (" + reason + "). Try again in a minute.";
  }
}

// Line chart of the last 24 hours.
function drawChart(points) {
  const width = 720;
  const height = 320;
  const margin = { top: 16, right: 24, bottom: 36, left: 56 };

  const highest = d3.max(points, p => p.aqi);
  const topOfChart = Math.max(100, Math.ceil((highest + 10) / 50) * 50);

  const x = d3.scaleUtc()
    .domain(d3.extent(points, p => p.time))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, topOfChart])
    .range([height - margin.bottom, margin.top]);

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

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.utcFormat("%-I %p")));

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

  // "Now" label on the latest point.
  const last = points[points.length - 1];
  svg.append("text")
    .attr("x", x(last.time) - 6)
    // move it below the point if it would go off the top
    .attr("y", y(last.aqi) < margin.top + 20 ? y(last.aqi) + 20 : y(last.aqi) - 10)
    .attr("text-anchor", "end")
    .attr("font-weight", 600)
    .attr("fill", "#1f4e9c")
    .text("Now: " + last.aqi);
}

// Health message for the latest AQI value.
function showAdvice(latest) {
  const level = levelFor(latest.aqi);
  adviceBox.style.borderLeftColor = level.color;
  const heading = document.createElement("strong");
  heading.textContent = level.name + " (AQI " + latest.aqi + ").";
  adviceBox.replaceChildren(heading, " " + level.advice);
  adviceBox.hidden = false;
}

placeSelect.addEventListener("change", showPlace);
showPlace();
