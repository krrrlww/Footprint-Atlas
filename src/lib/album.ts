import type { AlbumDay, TimelineStop, TravelAlbum } from "../types/album";
import { computeBounds, projectPoint } from "./geo";

export type PositionedStop = TimelineStop & {
  x: number;
  y: number;
  usedGps: boolean;
  globalIndex: number;
};

export function flattenStops(album: TravelAlbum): TimelineStop[] {
  return album.days.flatMap((day) => day.stops);
}

export function positionStops(album: TravelAlbum): PositionedStop[] {
  const stops = flattenStops(album);
  const bounds = computeBounds(stops);

  return stops.map((stop, index) => {
    const position = projectPoint(stop, bounds, index, stops.length);
    return {
      ...stop,
      ...position,
      globalIndex: index
    };
  });
}

export function getFeaturedStops(day: AlbumDay, count = 4): TimelineStop[] {
  return [...day.stops]
    .sort((a, b) => b.photos.length - a.photos.length)
    .slice(0, count);
}

export function formatStopCounter(index: number): string {
  return String(index + 1).padStart(2, "0");
}
