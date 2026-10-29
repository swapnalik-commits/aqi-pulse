// Tests for the trend rule. Run from the project folder:  node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { TREND_RULE, labelForChange, getTrend, hoursText } = require("../js/trend.js");

const T = TREND_RULE.threshold;

test("a rise bigger than the threshold is Worsening", () => {
  assert.equal(labelForChange(T + 1), "Worsening");
});

test("a drop bigger than the threshold is Improving", () => {
  assert.equal(labelForChange(-(T + 1)), "Improving");
});

test("changes up to the threshold are Stable", () => {
  assert.equal(labelForChange(0), "Stable");
  assert.equal(labelForChange(T), "Stable");
  assert.equal(labelForChange(-T), "Stable");
});

test("getTrend compares the latest value with the one TREND_RULE.hours earlier", () => {
  const values = [40, 50, 52, 55, 70];
  const earlier = values[values.length - 1 - TREND_RULE.hours];
  const trend = getTrend(values);
  assert.equal(trend.latest, 70);
  assert.equal(trend.earlier, earlier);
  assert.equal(trend.change, 70 - earlier);
  assert.equal(trend.label, labelForChange(70 - earlier));
});

test("getTrend returns null when there isn't enough data", () => {
  assert.equal(getTrend([]), null);
  assert.equal(getTrend(new Array(TREND_RULE.hours).fill(50)), null);
});

test("getTrend skips missing values", () => {
  const trend = getTrend([50, null, 50, 50, undefined, 50]);
  assert.equal(trend.label, "Stable");
  assert.equal(trend.change, 0);
});

test("the page uses the 1-hour, 5-point rule from the findings", () => {
  assert.equal(TREND_RULE.hours, 1);
  assert.equal(TREND_RULE.threshold, 5);
});

test("hoursText says 1 hour, not 1 hours", () => {
  assert.equal(hoursText(1), "1 hour");
  assert.equal(hoursText(3), "3 hours");
});
