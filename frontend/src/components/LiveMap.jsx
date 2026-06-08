import React, { useEffect, useMemo, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";

// Fix default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function divIcon(color, label) {
  return L.divIcon({
    className: "campus-marker",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid #09090b;box-shadow:0 0 0 2px ${color};display:grid;place-items:center;color:#000;font-weight:800;font-size:10px;font-family:'JetBrains Mono',monospace;">${label || ""}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const DRIVER_ICON = divIcon("#FFB800", "D");
const PASSENGER_ICON = divIcon("#007AFF", "P");
const PICKUP_ICON = divIcon("#10B981", "•");
const DEST_ICON = divIcon("#EF4444", "•");

// CampusGo theme route styles
const ROUTE_STYLE_PRIMARY = { color: "#FFB800", weight: 4, opacity: 0.8 };
const ROUTE_STYLE_SECONDARY = { color: "#FFB800", weight: 2.5, opacity: 0.5, dashArray: "8 6" };

async function fetchRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&overview=full&alternatives=false&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Route fetch failed");
  const data = await res.json();
  if (!data.routes?.length) throw new Error("No route found");
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function LiveMap({
  center = [29.8648, 77.8964],
  zoom = 15,
  drivers = [],
  passengerLocation = null,
  pickup = null,
  destination = null,
  driverLocation = null,
  height = 420,
  testId = "live-map",
}) {
  const [routeCoords, setRouteCoords] = useState(null);
  const [driverRouteCoords, setDriverRouteCoords] = useState(null);
  const cancelledRef = useRef(false);

  // Fetch main route (pickup → destination)
  useEffect(() => {
    if (!pickup?.lat || !destination?.lat) {
      setRouteCoords(null);
      return;
    }
    let cancelled = false;
    cancelledRef.current = false;

    (async () => {
      try {
        const coords = await fetchRoute(pickup.lat, pickup.lng, destination.lat, destination.lng);
        if (!cancelled) setRouteCoords(coords);
      } catch {
        if (!cancelled) setRouteCoords([[pickup.lat, pickup.lng], [destination.lat, destination.lng]]);
      }
    })();

    return () => { cancelled = true; cancelledRef.current = true; };
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  // Fetch driver route (driver → pickup)
  useEffect(() => {
    if (!driverLocation?.lat || !driverLocation?.lng || !pickup?.lat) {
      setDriverRouteCoords(null);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const coords = await fetchRoute(driverLocation.lat, driverLocation.lng, pickup.lat, pickup.lng);
        if (!cancelled && !cancelledRef.current) setDriverRouteCoords(coords);
      } catch {
        if (!cancelled && !cancelledRef.current) setDriverRouteCoords([[driverLocation.lat, driverLocation.lng], [pickup.lat, pickup.lng]]);
      }
    })();

    return () => { cancelled = true; };
  }, [driverLocation?.lat, driverLocation?.lng, pickup?.lat, pickup?.lng]);

  const recenterTo = useMemo(() => {
    if (passengerLocation) return [passengerLocation.lat, passengerLocation.lng];
    if (drivers.length) return [drivers[0].lat, drivers[0].lng];
    return center;
  }, [passengerLocation, drivers, center]);

  return (
    <div data-testid={testId} className="rounded-md overflow-hidden border border-zinc-800" style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap, &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Recenter center={recenterTo} />

        {/* Route layers rendered below markers for visual layering */}
        {routeCoords && (
          <Polyline positions={routeCoords} pathOptions={ROUTE_STYLE_PRIMARY}>
            <Tooltip direction="center" className="route-tooltip" sticky>
              {pickup?.label} → {destination?.label}
            </Tooltip>
          </Polyline>
        )}
        {driverRouteCoords && (
          <Polyline positions={driverRouteCoords} pathOptions={ROUTE_STYLE_SECONDARY}>
            <Tooltip direction="center" className="route-tooltip" sticky>
              Driver → {pickup?.label}
            </Tooltip>
          </Polyline>
        )}

        {drivers.filter(d => d?.lat && d?.lng).map((d) => (
          <React.Fragment key={d.id}>
            <Marker position={[d.lat, d.lng]} icon={DRIVER_ICON}>
              <Popup>
                <div className="text-zinc-900">
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs">{d.vehicle_model} · {d.vehicle_number}</div>
                  <div className="text-xs">★ {Number(d.rating_avg || 5).toFixed(1)}</div>
                </div>
              </Popup>
            </Marker>
            <Circle center={[d.lat, d.lng]} radius={50} pathOptions={{ color: "#FFB800", weight: 1, opacity: 0.4, fillOpacity: 0.06 }} />
          </React.Fragment>
        ))}
        {passengerLocation?.lat && (
          <Marker position={[passengerLocation.lat, passengerLocation.lng]} icon={PASSENGER_ICON}>
            <Popup><div className="text-zinc-900">You</div></Popup>
          </Marker>
        )}
        {pickup?.lat && (
          <Marker position={[pickup.lat, pickup.lng]} icon={PICKUP_ICON}>
            <Popup><div className="text-zinc-900">Pickup: {pickup.label}</div></Popup>
          </Marker>
        )}
        {destination?.lat && (
          <Marker position={[destination.lat, destination.lng]} icon={DEST_ICON}>
            <Popup><div className="text-zinc-900">Destination: {destination.label}</div></Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
