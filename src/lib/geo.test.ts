import { describe, expect, it } from "vitest";
import { computeBounds, haversineKm, projectPoint } from "./geo";

describe("geo helpers", () => {
  it("computes bounds from GPS points", () => {
    const bounds = computeBounds([
      { latitude: -8.7, longitude: 115.1 },
      { latitude: -8.5, longitude: 115.4 },
      { latitude: null, longitude: null }
    ]);

    expect(bounds).toEqual({
      minLat: -8.7,
      maxLat: -8.5,
      minLon: 115.1,
      maxLon: 115.4
    });
  });

  it("projects GPS points into the map stage", () => {
    const position = projectPoint(
      { latitude: 10, longitude: 20 },
      { minLat: 0, maxLat: 20, minLon: 10, maxLon: 30 },
      0,
      1
    );

    expect(position.usedGps).toBe(true);
    expect(position.x).toBeCloseTo(50);
    expect(position.y).toBeCloseTo(45);
  });

  it("falls back to an editorial path when GPS is absent", () => {
    const position = projectPoint({ latitude: null, longitude: null }, null, 1, 3);

    expect(position.usedGps).toBe(false);
    expect(position.x).toBeGreaterThan(40);
    expect(position.y).toBeLessThan(40);
  });

  it("calculates distance between nearby coordinates", () => {
    const distance = haversineKm(
      { latitude: 31.2304, longitude: 121.4737 },
      { latitude: 31.235, longitude: 121.48 }
    );

    expect(distance).not.toBeNull();
    expect(distance ?? 0).toBeGreaterThan(0.5);
    expect(distance ?? 0).toBeLessThan(2);
  });
});
