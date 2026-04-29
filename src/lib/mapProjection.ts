import { geoGraticule, geoMercator, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import { feature, mesh } from "topojson-client";
import countriesTopology from "world-atlas/countries-110m.json";
import type { PositionedStop } from "./album";
import { hasGps } from "./geo";
import type { TimelineStop } from "../types/album";

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 720;
const MAP_PADDING: [[number, number], [number, number]] = [
  [86, 82],
  [914, 610],
];

type ScreenPoint = {
  screenX: number;
  screenY: number;
};

export type RealMapStop = PositionedStop & ScreenPoint;

export type RealMapProjection = {
  width: number;
  height: number;
  stops: RealMapStop[];
  routePoints: string;
  landPath: string;
  borderPath: string;
  graticulePath: string;
};

const countryCollection = feature(
  countriesTopology as never,
  (countriesTopology as { objects: { countries: unknown } }).objects.countries as never
) as unknown as FeatureCollection<Polygon | MultiPolygon>;

const countryBorders = mesh(
  countriesTopology as never,
  (countriesTopology as { objects: { countries: unknown } }).objects.countries as never,
  (a, b) => a !== b
) as unknown as Geometry;

export function buildRealMapProjection(stops: TimelineStop[]): RealMapProjection {
  const projection = createProjection(stops);
  const path = geoPath(projection);
  const graticule = geoGraticule().step([5, 5]);
  const projected = stops.map((stop, index) => {
    const point = projectStop(stop, stops, index, projection);
    return {
      ...stop,
      ...point,
      x: (point.screenX / MAP_WIDTH) * 100,
      y: (point.screenY / MAP_HEIGHT) * 100,
      usedGps: hasGps(stop),
      globalIndex: index,
    };
  });

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    stops: projected,
    routePoints: projected.map((stop) => `${stop.screenX.toFixed(1)},${stop.screenY.toFixed(1)}`).join(" "),
    landPath: path(countryCollection) ?? "",
    borderPath: path(countryBorders) ?? "",
    graticulePath: path(graticule()) ?? "",
  };
}

function createProjection(stops: TimelineStop[]): GeoProjection {
  const fitFeature = buildFitFeature(stops);
  return geoMercator().fitExtent(MAP_PADDING, fitFeature);
}

function buildFitFeature(stops: TimelineStop[]): Feature<Polygon> {
  const points = stops.flatMap<Position>((stop) => (hasGps(stop) ? [[stop.longitude, stop.latitude]] : []));

  if (points.length === 0) {
    return bboxFeature(70, 15, 135, 55);
  }

  const bounds = points.reduce(
    (result, point) => ({
      minLon: Math.min(result.minLon, point[0]),
      maxLon: Math.max(result.maxLon, point[0]),
      minLat: Math.min(result.minLat, point[1]),
      maxLat: Math.max(result.maxLat, point[1]),
    }),
    {
      minLon: points[0][0],
      maxLon: points[0][0],
      minLat: points[0][1],
      maxLat: points[0][1],
    }
  );

  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.8);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.8);
  const lonPad = Math.max(lonSpan * 0.22, 1.8);
  const latPad = Math.max(latSpan * 0.28, 1.4);

  return bboxFeature(
    clamp(bounds.minLon - lonPad, -179, 179),
    clamp(bounds.minLat - latPad, -70, 84),
    clamp(bounds.maxLon + lonPad, -179, 179),
    clamp(bounds.maxLat + latPad, -70, 84)
  );
}

function bboxFeature(minLon: number, minLat: number, maxLon: number, maxLat: number): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ],
      ],
    },
  };
}

function projectStop(stop: TimelineStop, stops: TimelineStop[], index: number, projection: GeoProjection): ScreenPoint {
  if (hasGps(stop)) {
    const point = projection([stop.longitude, stop.latitude]);
    if (point) return clampScreenPoint(point[0], point[1]);
  }

  const neighboringPoint = inferMissingGpsPoint(stops, index, projection);
  if (neighboringPoint) return neighboringPoint;

  return fallbackScreenPoint(index, stops.length);
}

function inferMissingGpsPoint(stops: TimelineStop[], index: number, projection: GeoProjection): ScreenPoint | null {
  const previous = findNeighborGps(stops, index, -1, projection);
  const next = findNeighborGps(stops, index, 1, projection);

  if (previous && next) {
    const offset = index % 2 === 0 ? -28 : 28;
    return clampScreenPoint((previous.screenX + next.screenX) / 2, (previous.screenY + next.screenY) / 2 + offset);
  }

  if (previous) return clampScreenPoint(previous.screenX + 36, previous.screenY + 24);
  if (next) return clampScreenPoint(next.screenX - 36, next.screenY - 24);

  return null;
}

function findNeighborGps(
  stops: TimelineStop[],
  startIndex: number,
  direction: -1 | 1,
  projection: GeoProjection
): ScreenPoint | null {
  for (let index = startIndex + direction; index >= 0 && index < stops.length; index += direction) {
    const stop = stops[index];
    if (!hasGps(stop)) continue;
    const point = projection([stop.longitude, stop.latitude]);
    if (point) return clampScreenPoint(point[0], point[1]);
  }

  return null;
}

function fallbackScreenPoint(index: number, total: number): ScreenPoint {
  const safeTotal = Math.max(total, 1);
  const progress = safeTotal === 1 ? 0.5 : index / (safeTotal - 1);
  return clampScreenPoint(
    MAP_WIDTH * (0.16 + progress * 0.68),
    MAP_HEIGHT * (0.68 - Math.sin(progress * Math.PI) * 0.36 + Math.cos(progress * Math.PI * 2) * 0.06)
  );
}

function clampScreenPoint(x: number, y: number): ScreenPoint {
  return {
    screenX: clamp(x, 46, MAP_WIDTH - 46),
    screenY: clamp(y, 54, MAP_HEIGHT - 96),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
