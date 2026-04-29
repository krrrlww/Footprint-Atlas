export type GeoPoint = {
  latitude: number | null;
  longitude: number | null;
};

export type Bounds = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

export function hasGps(point: GeoPoint): point is { latitude: number; longitude: number } {
  return typeof point.latitude === "number" && typeof point.longitude === "number";
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number | null {
  if (!hasGps(a) || !hasGps(b)) return null;

  const radiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function computeBounds(points: GeoPoint[]): Bounds | null {
  const gps = points.filter(hasGps);
  if (gps.length === 0) return null;

  return gps.reduce<Bounds>(
    (bounds, point) => ({
      minLat: Math.min(bounds.minLat, point.latitude),
      maxLat: Math.max(bounds.maxLat, point.latitude),
      minLon: Math.min(bounds.minLon, point.longitude),
      maxLon: Math.max(bounds.maxLon, point.longitude)
    }),
    {
      minLat: gps[0].latitude,
      maxLat: gps[0].latitude,
      minLon: gps[0].longitude,
      maxLon: gps[0].longitude
    }
  );
}

export function projectPoint(
  point: GeoPoint,
  bounds: Bounds | null,
  fallbackIndex: number,
  total: number
): { x: number; y: number; usedGps: boolean } {
  if (!bounds || !hasGps(point)) {
    return fallbackPoint(fallbackIndex, total);
  }

  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.0001);
  const x = 12 + ((point.longitude - bounds.minLon) / lonSpan) * 76;
  const y = 14 + (1 - (point.latitude - bounds.minLat) / latSpan) * 62;

  return {
    x: clamp(x, 8, 90),
    y: clamp(y, 10, 78),
    usedGps: true
  };
}

function fallbackPoint(index: number, total: number): { x: number; y: number; usedGps: boolean } {
  const safeTotal = Math.max(total, 1);
  const progress = safeTotal === 1 ? 0.5 : index / (safeTotal - 1);
  const x = 16 + progress * 68;
  const y = 67 - Math.sin(progress * Math.PI) * 38 + Math.cos(progress * Math.PI * 2) * 5;

  return {
    x: clamp(x, 10, 88),
    y: clamp(y, 16, 76),
    usedGps: false
  };
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
