"""Serve AQI Pulse locally and proxy NASA FIRMS requests using .env."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from csv import DictReader
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.request import Request, urlopen
import json
import math
import os


ROOT = Path(__file__).resolve().parent
FIRMS_SOURCES = ("VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT")
SEARCH_RADIUS_KM = 275


def load_map_key():
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return ""
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        name, separator, value = line.partition("=")
        if separator and name.strip() == "MAP_KEY":
            return value.strip().strip("\"'")
    return ""


MAP_KEY = load_map_key()


def distance_km(lat1, lon1, lat2, lon2):
    radians = math.radians
    lat_delta = radians(lat2 - lat1)
    lon_delta = radians(lon2 - lon1)
    arc = 2 * math.asin(math.sqrt(
        math.sin(lat_delta / 2) ** 2
        + math.cos(radians(lat1)) * math.cos(radians(lat2)) * math.sin(lon_delta / 2) ** 2
    ))
    return 6371 * arc


def fetch_source(source, bounds):
    url = (
        "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
        + quote(MAP_KEY, safe="") + "/" + source + "/" + quote(bounds, safe=",") + "/1"
    )
    request = Request(url, headers={"User-Agent": "AQI-Pulse/1.0"})
    with urlopen(request, timeout=20) as response:
        body = response.read().decode("utf-8-sig")
    if body.startswith("Invalid MAP_KEY"):
        raise ValueError("NASA FIRMS did not accept the MAP_KEY in .env.")

    detections = []
    for row in DictReader(StringIO(body)):
        try:
            latitude = float(row["latitude"])
            longitude = float(row["longitude"])
            date = row["acq_date"]
            time = row["acq_time"].strip().zfill(4)
            if len(time) != 4 or not time.isdigit():
                continue
            timestamp = f"{date}T{time[:2]}:{time[2:]}:00Z"
        except (KeyError, TypeError, ValueError):
            continue
        detections.append({"latitude": latitude, "longitude": longitude, "detectedAt": timestamp})
    return detections


def nearby_fires(latitude, longitude):
    delta_lat = SEARCH_RADIUS_KM / 111
    delta_lon = SEARCH_RADIUS_KM / (111 * max(math.cos(math.radians(latitude)), 0.3))
    bounds = ",".join(str(value) for value in (
        longitude - delta_lon, latitude - delta_lat,
        longitude + delta_lon, latitude + delta_lat,
    ))

    detections = []
    errors = []
    with ThreadPoolExecutor(max_workers=len(FIRMS_SOURCES)) as executor:
        requests = [executor.submit(fetch_source, source, bounds) for source in FIRMS_SOURCES]
        for future in as_completed(requests):
            try:
                detections.extend(future.result())
            except (HTTPError, URLError, TimeoutError, ValueError) as error:
                errors.append(error)

    if errors and not detections:
        error = errors[0]
        if isinstance(error, HTTPError):
            message = f"NASA FIRMS request failed (HTTP {error.code})."
        elif isinstance(error, ValueError):
            message = str(error)
        else:
            message = "Could not reach NASA FIRMS. Check your internet connection and try again."
        raise RuntimeError(message)

    return [fire for fire in detections
            if distance_km(latitude, longitude, fire["latitude"], fire["longitude"]) <= SEARCH_RADIUS_KM]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlsplit(self.path)
        requested_path = unquote(parsed.path)
        if any(part.startswith(".") for part in requested_path.split("/")):
            self.send_error(404)
            return
        if requested_path != "/api/fires":
            return super().do_GET()

        if not MAP_KEY:
            return self.send_json(503, {"message": "Add MAP_KEY=<your FIRMS map key> to .env, then restart the server."})

        try:
            query = parse_qs(parsed.query)
            latitude = float(query["latitude"][0])
            longitude = float(query["longitude"][0])
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                raise ValueError
            result = nearby_fires(latitude, longitude)
        except (KeyError, IndexError, ValueError):
            return self.send_json(400, {"message": "Provide valid latitude and longitude values."})
        except RuntimeError as error:
            return self.send_json(502, {"message": str(error)})

        return self.send_json(200, result)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    if not MAP_KEY:
        print("No MAP_KEY found in .env; add it before loading fire detections.")
    address = ("127.0.0.1", int(os.environ.get("AQI_PULSE_PORT", "8000")))
    server = ThreadingHTTPServer(address, Handler)
    print(f"AQI Pulse is running at http://{address[0]}:{address[1]}/ (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
