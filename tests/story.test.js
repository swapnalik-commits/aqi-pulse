const test = require("node:test");
const assert = require("node:assert/strict");
const { fireStory, windStory, airStory } = require("../js/story.js");

test("fire story names a partial satellite failure", () => {
  const line = fireStory({
    count: 4,
    demo: false,
    error: null,
    sourcesFailed: 1,
    sources: 3
  }, "Seattle");
  assert.equal(line.kind, "warn");
  assert.match(line.text, /1 of 3 satellite feeds/);
  assert.match(line.text, /4 recent fire detections/);
});

test("fire story does not call demo dots live detections", () => {
  const line = fireStory({ count: 3, demo: true, error: null }, "Denver");
  assert.match(line.text, /DEMO SAMPLE/);
  assert.doesNotMatch(line.text, /satellite feeds did not respond/);
});

test("wind story puts the hour and the upwind count in one line", () => {
  const line = windStory(
    { speed: 5.4, direction: 315, compass: "NW" },
    "Seattle",
    4,
    10
  );
  assert.match(line.text, /this hour/);
  assert.match(line.text, /About 4 of the mapped fires/);
});

test("air story uses the trend sentence when a label exists", () => {
  globalThis.changeText = require("../js/trend.js").changeText;
  const line = airStory({
    ready: true,
    trend: { label: "Worsening", change: 8 },
    points: [{ aqi: 40 }, { aqi: 48 }]
  });
  assert.match(line.text, /worsening/i);
  assert.match(line.text, /last 1 hour/);
});

test("air story reports a failed load", () => {
  const line = airStory({ ready: true, trend: null, points: [] });
  assert.equal(line.kind, "error");
});
