# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Footprint Atlas — a local-first personal footprint map generator. Users drop geotagged travel photos into `raw/photos/`, and the app extracts EXIF data (time, GPS) to build an interactive vintage-styled map of all places they've been. It is **not** a single-trip route tool; it's a growing "all places" archive.

## Commands

```bash
npm run dev          # Vite dev server on :5173 (also serves local API endpoints)
npm run build        # tsc -b && vite build → dist/
npm run test         # vitest run
npm run album:build  # Process raw/photos → generate album JSON + optimized images
npm run album:ai     # AI enrichment: generate Memory Capsules + Period Narratives
npm run album:full   # album:build + album:ai in sequence
npm run album:reset  # Wipe generated data (keeps raw/photos originals)
```

### AI Enrichment

`scripts/enrich-ai.mjs` adds AI-generated content to an existing `album.json`. Requires env vars:

```bash
AI_API_KEY=sk-xxx npm run album:ai                    # Text-only (DeepSeek default)
AI_API_KEY=sk-xxx AI_VISION_MODEL=... npm run album:ai # Text + Vision
```

Env vars: `AI_API_KEY`, `AI_BASE_URL` (default: DeepSeek), `AI_TEXT_MODEL`, `AI_VISION_MODEL`, `AI_VISION_BASE_URL`, `AI_VISION_API_KEY`. Results cached in `data/ai-cache.json`.

## Architecture

### Data Pipeline (Node scripts, runs outside browser)

`scripts/ingest-photos.mjs` is the core data pipeline:
1. Reads images from `raw/photos/` (recursive, supports jpg/png/webp/heic/tiff + video)
2. Extracts EXIF via `exiftool-vendored` (date, GPS), applies manual overrides from `data/manual-overrides.json`
3. Reverse-geocodes GPS coordinates via Nominatim → human-readable location names, cached in `data/geocode-cache.json`
4. Generates optimized images via `sharp` → `public/media/full/` (1800px) and `public/media/thumbs/` (640×420 cover)
5. Groups photos into Periods (by month) and Footprint Stops (by time gaps >6h or distance >12km)
6. Writes `public/album.json` (consumed by frontend), `data/media.json`, `data/album.json`

`scripts/enrich-ai.mjs` is the optional AI enrichment step:
1. Reads `public/album.json` produced by ingest
2. For each stop: generates a `MemoryCapsule` (poetic title, first-person journal note, mood, scene, colors, tags)
3. For each period: generates a `PeriodNarrative` (poetic title, story arc, postcard to future self)
4. Optionally uses a vision model to describe photo contents before generating text
5. Writes enriched data back to `public/album.json`. Caches results in `data/ai-cache.json`

### Data Hierarchy

```
TravelAlbum → AlbumDay (period/month) → TimelineStop (footprint cluster) → MediaItem (photo)
```

Despite the naming, `AlbumDay` represents a **month/period**, not a calendar day. `dayKey` is `YYYY-MM` for period grouping.

### Frontend (React + Vite)

- `App.tsx` — top-level state: loads `album.json`, manages active period/modal/editor state
- `MapStage.tsx` — the map: uses `d3-geo` Mercator projection with `world-atlas` TopoJSON data. Handles zoom/pan/drag, clusters nearby stops into aggregate pins at low zoom, SVG rendering of land/borders/graticule/route-line
- `DayModal.tsx` — archive log modal for a period. Renders `MemoryCapsule` (journal notes, mood tags, color dots) and `PeriodNarrative` (story, postcard) when available, falls back to template text otherwise
- `UnplacedEditor.tsx` — editor for photos missing GPS: geocode search (local gazetteer + Open-Meteo API), saves to manual-overrides
- `PhotoUploader.tsx` — drag-and-drop upload in dev mode

### Vite Dev Server API (`vite.config.ts`)

The Vite config contains a custom plugin `manualMetadataApi()` that adds dev-only API routes:
- `GET /api/manual-overrides` — read current overrides
- `POST /api/manual-overrides` — save overrides, re-runs `ingest-photos.mjs`, returns fresh album
- `GET /api/geocode?query=...` — local gazetteer + Open-Meteo geocoding
- `POST /api/upload-photos` — multipart upload via Busboy, saves to `raw/photos/`, re-runs ingest

These endpoints only exist in dev mode. The built static site has no backend.

### Map Projection (`src/lib/mapProjection.ts`)

Uses `d3-geo` `geoMercator().fitExtent()` to auto-fit all stops into a 1000×720 SVG canvas. Stops without GPS are interpolated from neighbors or placed along a fallback curve.

### Geo Utilities (`src/lib/geo.ts`)

Haversine distance, bounds computation, and a simple linear projection (used by `album.ts`). The `mapProjection.ts` module uses the more accurate d3 projection instead.

## Key Conventions

- UI text is bilingual: structural labels in English (vintage atlas style), user-facing descriptions in Chinese
- All types are in `src/types/album.ts` — `TravelAlbum`, `AlbumDay`, `TimelineStop`, `MediaItem`, `MemoryCapsule`, `PeriodNarrative`
- Styling is in a single `src/styles/app.css` (vintage kraft-paper theme)
- The `sampleAlbum.ts` provides fallback data when no `album.json` exists yet
- AI features are build-time only: `enrich-ai.mjs` writes to JSON, frontend has zero AI dependency
- No API key = graceful fallback to template text, AI is purely additive
