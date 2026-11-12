const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FIRE_DEDUPE_KM,
  dedupeFires,
  ageHours,
  isUpwind,
  countUpwind,
  circlePolygon,
  wedgePolygon,
  angleDiff
} = require("../js/geo.js");

test("dedupe keeps the newest of two satellites on the same hotspot", () => {
  const fires = dedupeFires([
    { latitude: 34.05, longitude: -118.24, detectedAt: "2026-11-05T18:00:00Z" },
    { latitude: 34.051, longitude: -118.241, detectedAt: "2026-11-05T20:00:00Z" }
  ]);
  assert.equal(fires.length, 1);
  assert.equal(fires[0].detectedAt, "2026-11-05T20:00:00Z");
  assert.ok(FIRE_DEDUPE_KM >= 1);
});

test("dedupe keeps fires that are far apart", () => {
  const fires = dedupeFires([
    { latitude: 34.05, longitude: -118.24, detectedAt: "2026-11-05T18:00:00Z" },
    { latitude: 34.5, longitude: -118.24, detectedAt: "2026-11-05T18:00:00Z" }
  ]);
  assert.equal(fires.length, 2);
});

test("a fire south of the city is upwind when the wind blows north", () => {
  const place = { latitude: 34.05, longitude: -118.24 };
  const south = { latitude: 33.7, longitude: -118.24 };
  const north = { latitude: 34.4, longitude: -118.24 };
  assert.equal(isUpwind(south.latitude, south.longitude, place.latitude, place.longitude, 0), true);
  assert.equal(isUpwind(north.latitude, north.longitude, place.latitude, place.longitude, 0), false);
  assert.equal(countUpwind([south, north], place, 0), 1);
  assert.equal(countUpwind([south], place, null), null);
});

test("angle difference wraps around north", () => {
  assert.ok(angleDiff(350, 10) < 45);
  assert.ok(angleDiff(0, 180) > 45);
});

test("age is zero for a detection timestamped at now", () => {
  const now = Date.parse("2026-11-05T20:00:00Z");
  assert.equal(ageHours("2026-11-05T20:00:00Z", now), 0);
  assert.ok(ageHours("2026-11-05T17:00:00Z", now) > 2.9);
  assert.equal(ageHours("not-a-time", now), null);
});

test("search circle and upwind wedge are closed polygons", () => {
  const circle = circlePolygon(34.05, -118.24, 275);
  assert.ok(circle.length > 8);
  assert.deepEqual(circle[0], circle[circle.length - 1]);
  const wedge = wedgePolygon(34.05, -118.24, 275, 0, 45);
  assert.deepEqual(wedge[0], wedge[wedge.length - 1]);
  assert.equal(wedge[0][0], -118.24);
});
