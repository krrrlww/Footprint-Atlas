import { describe, expect, it } from "vitest";
import { buildRealMapProjection } from "./mapProjection";
import type { TimelineStop } from "../types/album";

const stops: TimelineStop[] = [
  {
    id: "qinghai",
    dayKey: "2023-07",
    index: 0,
    title: "Visited Place 01",
    subtitle: "Qinghai",
    type: "sight",
    time: "10:00",
    startAt: null,
    endAt: null,
    latitude: 37.3,
    longitude: 101.4,
    description: "",
    photos: []
  },
  {
    id: "guangxi",
    dayKey: "2024-08",
    index: 1,
    title: "Visited Place 02",
    subtitle: "Guangxi",
    type: "sight",
    time: "12:00",
    startAt: null,
    endAt: null,
    latitude: 24.7,
    longitude: 110.4,
    description: "",
    photos: []
  },
  {
    id: "missing",
    dayKey: "2025-02",
    index: 2,
    title: "Memory Place 03",
    subtitle: "No GPS",
    type: "memory",
    time: "18:00",
    startAt: null,
    endAt: null,
    latitude: null,
    longitude: null,
    description: "",
    photos: []
  }
];

describe("real map projection", () => {
  it("renders real map paths and projected stops", () => {
    const map = buildRealMapProjection(stops);

    expect(map.landPath.length).toBeGreaterThan(100);
    expect(map.borderPath.length).toBeGreaterThan(100);
    expect(map.graticulePath.length).toBeGreaterThan(100);
    expect(map.routePoints.split(" ")).toHaveLength(3);
    expect(map.stops).toHaveLength(3);
    expect(map.stops[0].usedGps).toBe(true);
    expect(map.stops[2].usedGps).toBe(false);

    for (const stop of map.stops) {
      expect(stop.x).toBeGreaterThanOrEqual(0);
      expect(stop.x).toBeLessThanOrEqual(100);
      expect(stop.y).toBeGreaterThanOrEqual(0);
      expect(stop.y).toBeLessThanOrEqual(100);
    }
  });
});
