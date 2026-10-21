// Trend rule: compare the latest AQI with the value TREND_RULE.hours earlier.
//   up by more than the threshold   -> Worsening
//   down by more than the threshold -> Improving
//   otherwise                       -> Stable
// Used by both the page and docs/backtest.js, so change the rule only here.

const TREND_RULE = {
  hours: 3,      // how far back to compare
  threshold: 10  // AQI points needed to count as a change
};

// Arrows so the label doesn't rely on red/green alone.
const TREND_ARROWS = {
  Worsening: "\u2191",
  Stable: "\u2192",
  Improving: "\u2193"
};

const TREND_COLORS = {
  Worsening: "#c0392b",
  Stable: "#6b7280",
  Improving: "#1e8449"
};

function labelForChange(change) {
  if (change > TREND_RULE.threshold) return "Worsening";
  if (change < -TREND_RULE.threshold) return "Improving";
  return "Stable";
}

// values = hourly AQI, oldest first. Returns null if there isn't enough data.
function getTrend(values) {
  const clean = values.filter(v => v !== null && v !== undefined);
  if (clean.length <= TREND_RULE.hours) return null;
  const latest = clean[clean.length - 1];
  const earlier = clean[clean.length - 1 - TREND_RULE.hours];
  const change = latest - earlier;
  return { label: labelForChange(change), change, latest, earlier };
}

if (typeof module !== "undefined") {
  module.exports = { TREND_RULE, TREND_COLORS, TREND_ARROWS, labelForChange, getTrend };
}
