// Checks how reliable the trend label is (research question 2).
// Run from the project folder (Node 18+):  node docs/backtest.js
//
// For each place: get 92 days of hourly AQI, work out the label the page would
// have shown each hour, then compare it with what actually happened next.

const { TREND_RULE, labelForChange, hoursText } = require("../js/trend.js");

const PLACES = [
  { name: "Los Angeles", lat: 34.05, lon: -118.24 },
  { name: "Denver", lat: 39.74, lon: -104.99 },
  { name: "Seattle", lat: 47.61, lon: -122.33 }
];

const LABELS = ["Worsening", "Stable", "Improving"];
const H = TREND_RULE.hours;

function backtest(times, aqi) {
  const rows = { Worsening: { n: 0, sameNext: 0, heldDirection: 0 },
                 Stable: { n: 0, sameNext: 0, heldDirection: 0 },
                 Improving: { n: 0, sameNext: 0, heldDirection: 0 } };
  const examples = { right: [], wrong: [] };
  let total = 0, matched = 0, stableNext = 0;

  for (let i = H; i + H < aqi.length; i++) {
    const before = aqi[i - H], now = aqi[i], after = aqi[i + H];
    if (before === null || now === null || after === null) continue;

    const label = labelForChange(now - before);
    const next = labelForChange(after - now);
    // looser check: did the AQI at least keep moving the same way?
    const held = label === "Worsening" ? after >= now
               : label === "Improving" ? after <= now
               : next === "Stable";

    total++;
    rows[label].n++;
    if (label === next) { matched++; rows[label].sameNext++; }
    if (held) rows[label].heldDirection++;
    if (next === "Stable") stableNext++;

    if (label !== "Stable") {
      const ex = { time: times[i], label, before, now, after, next };
      if (label === next && examples.right.length < 2) examples.right.push(ex);
      if (label !== next && examples.wrong.length < 2) examples.wrong.push(ex);
    }
  }
  return { total, matched, stableNext, rows, examples };
}

const pct = (a, b) => (b === 0 ? "n/a" : Math.round((100 * a) / b) + "%");

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("This script needs Node 18 or newer (for the built-in fetch).");
  }

  console.log("Rule: AQI now vs " + hoursText(H) + " ago, change of more than " +
    TREND_RULE.threshold + " points = Worsening / Improving, otherwise Stable.\n");

  const allSeries = [];
  for (const place of PLACES) {
    const url = "https://air-quality-api.open-meteo.com/v1/air-quality" +
      "?latitude=" + place.lat + "&longitude=" + place.lon +
      "&hourly=us_aqi&past_days=92&forecast_days=1&timezone=auto";
    const response = await fetch(url);
    if (!response.ok) throw new Error("Open-Meteo returned HTTP " + response.status + " for " + place.name);
    const data = await response.json();

    // drop forecast hours (times are local to the place)
    const nowLocal = new Date(Date.now() + data.utc_offset_seconds * 1000).toISOString().slice(0, 13);
    const keep = data.hourly.time.filter(t => t.slice(0, 13) <= nowLocal).length;
    const times = data.hourly.time.slice(0, keep);
    const aqi = data.hourly.us_aqi.slice(0, keep);

    const r = backtest(times, aqi);
    console.log("== " + place.name + " (" + times[0] + " to " + times[times.length - 1] + ", local time)");
    console.log("Hours checked: " + r.total + ". Label matched the next " + H + " hours: " +
      pct(r.matched, r.total) + ". (Just saying \"Stable\" every hour would score " +
      pct(r.stableNext, r.total) + ".)");
    for (const label of LABELS) {
      const row = r.rows[label];
      console.log("  " + label.padEnd(10) + " shown " + String(row.n).padStart(4) + " times | same label next: " +
        pct(row.sameNext, row.n).padStart(4) + " | direction held: " + pct(row.heldDirection, row.n));
    }
    for (const ex of [...r.examples.right, ...r.examples.wrong]) {
      console.log("  e.g. " + ex.time + ": AQI " + ex.before + " -> " + ex.now + " => \"" + ex.label +
        "\"; " + H + " h later AQI " + ex.after + " (" + ex.next + ")");
    }
    console.log("");
    allSeries.push(aqi);
  }

  // Try other look-back windows and thresholds to see if any work better.
  console.log("== Other versions of the rule (all places pooled)");
  console.log("look back | threshold | matched next | always-Stable | Worsening shown | W kept rising | I kept falling");
  for (const hours of [1, 3, 6]) {
    for (const threshold of [5, 10, 15, 20]) {
      const lab = c => (c > threshold ? "Worsening" : c < -threshold ? "Improving" : "Stable");
      let tot = 0, m = 0, sn = 0, w = 0, wh = 0, im = 0, ih = 0;
      for (const a of allSeries) {
        for (let i = hours; i + hours < a.length; i++) {
          const b = a[i - hours], n = a[i], f = a[i + hours];
          if (b === null || n === null || f === null) continue;
          const L = lab(n - b), N = lab(f - n);
          tot++; if (L === N) m++; if (N === "Stable") sn++;
          if (L === "Worsening") { w++; if (f >= n) wh++; }
          if (L === "Improving") { im++; if (f <= n) ih++; }
        }
      }
      console.log(String(hours + " h").padStart(9) + " | " + String(threshold).padStart(9) + " | " +
        pct(m, tot).padStart(12) + " | " + pct(sn, tot).padStart(13) + " | " + String(w).padStart(15) +
        " | " + pct(wh, w).padStart(13) + " | " + pct(ih, im).padStart(14));
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
