// Color key under the chart. It uses the same AQI_LEVELS list as the chart (main.js),
// so the colors and ranges always match.
function buildAqiLegend() {
  const list = document.querySelector("#aqi-legend");
  if (!list) return;

  let from = 0;
  const items = AQI_LEVELS.map((level, i) => {
    const last = i === AQI_LEVELS.length - 1;
    const range = last ? from + "+" : from + "–" + level.max;
    from = level.max + 1;

    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = level.color;
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, level.name + " " + range);
    return item;
  });

  list.replaceChildren(...items);
}

buildAqiLegend();
