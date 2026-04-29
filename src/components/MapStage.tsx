import { Camera, LocateFixed, MapPin, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flattenStops, formatStopCounter } from "../lib/album";
import { buildRealMapProjection, type RealMapStop } from "../lib/mapProjection";
import type { AlbumDay, TimelineStop, TravelAlbum } from "../types/album";

type MapStageProps = {
  album: TravelAlbum;
  activeDayId: string | null;
  onSelectDay: (dayId: string) => void;
  onOpenDay: (day: AlbumDay) => void;
  onOpenStop: (stop: TimelineStop) => void;
};

export function MapStage({ album, activeDayId, onSelectDay, onOpenDay, onOpenStop }: MapStageProps) {
  const realMap = useMemo(() => buildRealMapProjection(flattenStops(album)), [album]);
  const [viewport, setViewport] = useState(() => createViewport(realMap.width, realMap.height, 1));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    rectWidth: number;
    rectHeight: number;
    viewport: Viewport;
  } | null>(null);
  const activeDay = album.days.find((day) => day.id === activeDayId) ?? album.days[0];
  const activeStopIds = new Set(activeDay?.stops.map((stop) => stop.id) ?? []);
  const positionedStops = realMap.stops.map((stop) => ({
    ...stop,
    ...toViewportPercent(stop, viewport, realMap.width, realMap.height)
  }));
  const visibleStops = positionedStops.filter((stop) => isVisibleInViewport(stop.x, stop.y));
  const displayPins = clusterStops(visibleStops, clusterRadius(viewport.zoom));
  const labelStops = positionedStops
    .filter((stop) => isVisibleInViewport(stop.x, stop.y))
    .filter((_, index) => index % 2 === 0)
    .filter(() => viewport.zoom < 2.2)
    .slice(0, 6);
  const viewBox = getViewBox(viewport, realMap.width, realMap.height);

  useEffect(() => {
    setViewport(createViewport(realMap.width, realMap.height, 1));
  }, [album.generatedAt, realMap.width, realMap.height]);

  const setZoom = (nextZoom: number) => {
    setViewport((current) => constrainViewport({ ...current, zoom: clampZoom(nextZoom) }, realMap.width, realMap.height));
  };

  const focusActivePeriod = () => {
    if (!activeDay) return;
    const stops = realMap.stops.filter((stop) => activeStopIds.has(stop.id));
    if (stops.length === 0) return;
    setViewport(focusStops(stops, realMap.width, realMap.height));
  };

  const openPin = (pin: DisplayPin) => {
    if (pin.stops.length === 1 || viewport.zoom >= MAX_ZOOM - 0.1) {
      onOpenStop(pin.stops[0]);
      return;
    }

    setViewport(
      focusStops(pin.stops, realMap.width, realMap.height, {
        paddingX: 120,
        paddingY: 100,
        minZoom: viewport.zoom * 2.1
      })
    );
  };

  const panBy = (deltaX: number, deltaY: number, rectWidth: number, rectHeight: number, baseViewport: Viewport) => {
    const viewWidth = realMap.width / baseViewport.zoom;
    const viewHeight = realMap.height / baseViewport.zoom;

    setViewport(
      constrainViewport(
        {
          ...baseViewport,
          centerX: baseViewport.centerX - (deltaX / rectWidth) * viewWidth,
          centerY: baseViewport.centerY - (deltaY / rectHeight) * viewHeight
        },
        realMap.width,
        realMap.height
      )
    );
  };

  return (
    <div
      className={`map-stage ${isDragging ? "is-dragging" : ""}`}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          rectWidth: rect.width,
          rectHeight: rect.height,
          viewport
        };
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        panBy(
          event.clientX - dragRef.current.startX,
          event.clientY - dragRef.current.startY,
          dragRef.current.rectWidth,
          dragRef.current.rectHeight,
          dragRef.current.viewport
        );
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        setIsDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setIsDragging(false);
      }}
      onWheel={(event) => {
        event.preventDefault();
        setZoom(viewport.zoom * (event.deltaY < 0 ? 1.18 : 0.85));
      }}
    >
      <div className="map-stage__texture" />
      <svg
        className="geo-map"
        viewBox={viewBox}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path className="geo-graticule" d={realMap.graticulePath} />
        <path className="geo-land" d={realMap.landPath} />
        <path className="geo-borders" d={realMap.borderPath} />
        {positionedStops.length > 1 && <polyline points={realMap.routePoints} className="geo-route" />}
      </svg>

      <div className="map-compass" aria-hidden="true">
        <span>N</span>
        <i />
      </div>

      <div className="map-scale" aria-hidden="true">
        <span />
        archive scale
      </div>

      <div className="map-title-block">
        <em>{album.dateRange || "photo archive"}</em>
      </div>

      <div className="map-zoom-controls" aria-label="Map zoom controls">
        <button type="button" onClick={() => setZoom(viewport.zoom * 1.35)} title="放大地图">
          <ZoomIn size={15} />
        </button>
        <button type="button" onClick={() => setZoom(viewport.zoom / 1.35)} title="缩小地图">
          <ZoomOut size={15} />
        </button>
        <button type="button" onClick={focusActivePeriod} title="聚焦当前时期">
          <LocateFixed size={15} />
        </button>
        <button type="button" onClick={() => setViewport(createViewport(realMap.width, realMap.height, 1))} title="重置视图">
          <RotateCcw size={15} />
        </button>
        <span>{viewport.zoom.toFixed(1)}x</span>
      </div>



      {displayPins.map((pin) => (
        <PhotoPin
          key={pin.id}
          pin={pin}
          isMuted={activeDay ? !pin.stops.some((stop) => activeStopIds.has(stop.id)) : false}
          onOpen={() => openPin(pin)}
        />
      ))}


      <div className="map-day-strip">
        {album.days.map((day, index) => (
          <button
            key={day.id}
            className={day.id === activeDayId ? "is-active" : ""}
            onMouseEnter={() => onSelectDay(day.id)}
            onClick={() => onOpenDay(day)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {day.dateLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

type Viewport = {
  zoom: number;
  centerX: number;
  centerY: number;
};

const MAX_ZOOM = 18;

function createViewport(width: number, height: number, zoom: number): Viewport {
  return {
    zoom,
    centerX: width / 2,
    centerY: height / 2
  };
}

function getViewBox(viewport: Viewport, width: number, height: number): string {
  const bounded = constrainViewport(viewport, width, height);
  const viewWidth = width / bounded.zoom;
  const viewHeight = height / bounded.zoom;
  const left = bounded.centerX - viewWidth / 2;
  const top = bounded.centerY - viewHeight / 2;

  return `${left} ${top} ${viewWidth} ${viewHeight}`;
}

function toViewportPercent(stop: RealMapStop, viewport: Viewport, width: number, height: number) {
  const bounded = constrainViewport(viewport, width, height);
  const viewWidth = width / bounded.zoom;
  const viewHeight = height / bounded.zoom;
  const left = bounded.centerX - viewWidth / 2;
  const top = bounded.centerY - viewHeight / 2;

  return {
    x: ((stop.screenX - left) / viewWidth) * 100,
    y: ((stop.screenY - top) / viewHeight) * 100
  };
}

function focusStops(
  stops: RealMapStop[],
  width: number,
  height: number,
  options: { paddingX?: number; paddingY?: number; minZoom?: number } = {}
): Viewport {
  const bounds = stops.reduce(
    (result, stop) => ({
      minX: Math.min(result.minX, stop.screenX),
      maxX: Math.max(result.maxX, stop.screenX),
      minY: Math.min(result.minY, stop.screenY),
      maxY: Math.max(result.maxY, stop.screenY)
    }),
    {
      minX: stops[0].screenX,
      maxX: stops[0].screenX,
      minY: stops[0].screenY,
      maxY: stops[0].screenY
    }
  );
  const paddingX = options.paddingX ?? 260;
  const paddingY = options.paddingY ?? 210;
  const paddedWidth = Math.max(bounds.maxX - bounds.minX + paddingX, paddingX);
  const paddedHeight = Math.max(bounds.maxY - bounds.minY + paddingY, paddingY);
  const zoom = clampZoom(Math.max(Math.min(width / paddedWidth, height / paddedHeight), options.minZoom ?? 1));

  return constrainViewport(
    {
      zoom,
      centerX: (bounds.minX + bounds.maxX) / 2,
      centerY: (bounds.minY + bounds.maxY) / 2
    },
    width,
    height
  );
}

function constrainViewport(viewport: Viewport, width: number, height: number): Viewport {
  const zoom = clampZoom(viewport.zoom);
  const viewWidth = width / zoom;
  const viewHeight = height / zoom;

  return {
    zoom,
    centerX: clamp(viewport.centerX, viewWidth / 2, width - viewWidth / 2),
    centerY: clamp(viewport.centerY, viewHeight / 2, height - viewHeight / 2)
  };
}

function clampZoom(value: number): number {
  return clamp(value, 1, MAX_ZOOM);
}

function isVisibleInViewport(x: number, y: number): boolean {
  return x >= -8 && x <= 108 && y >= -8 && y <= 108;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type PhotoPinProps = {
  pin: DisplayPin;
  isMuted: boolean;
  onOpen: () => void;
};

function PhotoPin({ pin, isMuted, onOpen }: PhotoPinProps) {
  const photos = pin.photos.slice(0, 3);
  const count = pin.stops.length > 1 ? pin.stops.length : pin.photos.length;
  const rotation = (pin.globalIndex % 5) * 2 - 4;

  return (
    <button
      className={`photo-pin ${pin.stops.length > 1 ? "is-cluster" : ""} ${isMuted ? "is-muted" : ""}`}
      style={{ left: `${pin.x}%`, top: `${pin.y}%`, "--pin-rotation": `${rotation}deg` } as CSSProperties}
      onClick={onOpen}
      aria-label={pin.stops.length > 1 ? `Zoom into ${pin.stops.length} places` : `Open ${pin.stops[0].title}`}
    >
      <span className="photo-pin__needle" />
      <span className="photo-pin__stack">
        {photos.length > 0 ? (
          photos.map((photo, index) => (
            <img
              key={photo.id}
              src={photo.thumb}
              alt={photo.fileName}
              loading="lazy"
              style={{ transform: `translate(${index * -5}px, ${index * -4}px) rotate(${index * 4 - 3}deg)` }}
            />
          ))
        ) : (
          <span className="photo-pin__empty">
            <Camera size={22} />
          </span>
        )}
      </span>
      <span className="photo-pin__count">{count > 0 ? count : formatStopCounter(pin.globalIndex)}</span>
      {pin.stops.length > 1 && <span className="photo-pin__cluster-label">places</span>}
      {!pin.usedGps && (
        <span className="photo-pin__gps" title="No GPS, positioned by time">
          <MapPin size={11} />
        </span>
      )}
    </button>
  );
}

type ViewStop = RealMapStop & {
  x: number;
  y: number;
};

type DisplayPin = {
  id: string;
  x: number;
  y: number;
  usedGps: boolean;
  globalIndex: number;
  stops: ViewStop[];
  photos: RealMapStop["photos"];
};

function clusterStops(stops: ViewStop[], radius: number): DisplayPin[] {
  const clusters: DisplayPin[] = [];

  for (const stop of stops) {
    const cluster = clusters.find((candidate) => distance(candidate, stop) <= radius);

    if (!cluster) {
      clusters.push({
        id: stop.id,
        x: stop.x,
        y: stop.y,
        usedGps: stop.usedGps,
        globalIndex: stop.globalIndex,
        stops: [stop],
        photos: stop.photos
      });
      continue;
    }

    const nextCount = cluster.stops.length + 1;
    cluster.x = (cluster.x * cluster.stops.length + stop.x) / nextCount;
    cluster.y = (cluster.y * cluster.stops.length + stop.y) / nextCount;
    cluster.usedGps = cluster.usedGps && stop.usedGps;
    cluster.globalIndex = Math.min(cluster.globalIndex, stop.globalIndex);
    cluster.stops.push(stop);
    cluster.photos = [...cluster.photos, ...stop.photos].slice(0, 8);
    cluster.id = cluster.stops.map((item) => item.id).join("|");
  }

  return clusters;
}

function clusterRadius(zoom: number): number {
  return Math.max(2.6, 13 / Math.sqrt(zoom));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
