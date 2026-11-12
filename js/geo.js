// Shared map math for the page and node --test.
// Dedupe radius is also used in server.py (DEDUPE_KM). Keep the two the same.

const EARTH_RADIUS_KM = 6371;
const FIRE_DEDUPE_KM = 1.5;
const UPWIND_DEGREES = 45;

function distanceKm(lat1, lon1, lat2, lon2) {
  const radians = Math.PI / 180;
  const latDelta = (lat2 - lat1) * radians;
  const lonDelta = (lon2 - lon1) * radians;
  const arc = 2 * Math.asin(Math.sqrt(
    Math.sin(latDelta / 2) ** 2
    + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(lonDelta / 2) ** 2
  ));
  return EARTH_RADIUS_KM * arc;
}

function bearingDegrees(fromLat, fromLon, toLat, toLon) {
  const φ1 = fromLat * Math.PI / 180;
  const φ2 = toLat * Math.PI / 180;
  const Δλ = (toLon - fromLon) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angleDiff(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// [longitude, latitude], so it can go straight into GeoJSON.
function destinationPoint(lat, lon, distanceKmValue, bearingDeg) {
  const distance = distanceKmValue / EARTH_RADIUS_KM;
  const bearing = bearingDeg * Math.PI / 180;
  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(distance) + Math.cos(φ1) * Math.sin(distance) * Math.cos(bearing)
  );
  const λ2 = λ1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distance) * Math.cos(φ1),
    Math.cos(distance) - Math.sin(φ1) * Math.sin(φ2)
  );
  return [((λ2 * 180 / Math.PI + 540) % 360) - 180, φ2 * 180 / Math.PI];
}

function circlePolygon(lat, lon, radiusKm, steps) {
  const count = steps || 72;
  const ring = [];
  for (let i = 0; i < count; i += 1) {
    ring.push(destinationPoint(lat, lon, radiusKm, (360 * i) / count));
  }
  ring.push(ring[0]);
  return ring;
}

function wedgePolygon(lat, lon, radiusKm, centerBearing, halfAngle, steps) {
  const count = steps || 24;
  const ring = [[lon, lat]];
  const start = centerBearing - halfAngle;
  for (let i = 0; i <= count; i += 1) {
    ring.push(destinationPoint(lat, lon, radiusKm, start + (halfAngle * 2 * i) / count));
  }
  ring.push(ring[0]);
  return ring;
}

// Same hotspot seen by more than one satellite becomes one dot. Keep the newest.
function dedupeFires(fires, radiusKm) {
  const limit = radiusKm === undefined ? FIRE_DEDUPE_KM : radiusKm;
  const ordered = fires.slice().sort((a, b) => String(b.detectedAt).localeCompare(String(a.detectedAt)));
  const kept = [];
  ordered.forEach(fire => {
    const duplicate = kept.some(other =>
      distanceKm(fire.latitude, fire.longitude, other.latitude, other.longitude) <= limit
    );
    if (!duplicate) kept.push(fire);
  });
  return kept;
}

function ageHours(detectedAt, nowMs) {
  const detectedMs = new Date(detectedAt).getTime();
  if (!Number.isFinite(detectedMs)) return null;
  return Math.max(0, (nowMs - detectedMs) / 3600000);
}

function isUpwind(fireLat, fireLon, placeLat, placeLon, windToward) {
  if (!Number.isFinite(windToward)) return false;
  const bearing = bearingDegrees(fireLat, fireLon, placeLat, placeLon);
  return angleDiff(bearing, windToward) <= UPWIND_DEGREES;
}

function countUpwind(fires, place, windToward) {
  if (!Number.isFinite(windToward)) return null;
  return fires.reduce((total, fire) => (
    isUpwind(fire.latitude, fire.longitude, place.latitude, place.longitude, windToward)
      ? total + 1
      : total
  ), 0);
}

if (typeof module !== "undefined") {
  module.exports = {
    FIRE_DEDUPE_KM,
    UPWIND_DEGREES,
    distanceKm,
    bearingDegrees,
    angleDiff,
    destinationPoint,
    circlePolygon,
    wedgePolygon,
    dedupeFires,
    ageHours,
    isUpwind,
    countUpwind
  };
}
