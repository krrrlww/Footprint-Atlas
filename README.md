<h1 align="center">
  Footprint Atlas
</h1>

<p align="center">
  <strong>A vintage-styled personal footprint map, generated from your geotagged photos.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#ai-enrichment">AI Enrichment</a> ·
  <a href="#deploy">Deploy</a> ·
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/krrrlww/Footprint-Atlas" alt="MIT License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node >= 20" />
  <img src="https://img.shields.io/badge/react-19-blue" alt="React 19" />
</p>

---

<!-- TODO: replace with a 15s screen recording GIF -->
<!-- Record: map zoom/pan → click a day → scroll stops → open lightbox → close -->
<!-- Recommended: 800px wide, <5MB, use gifski or LICEcap -->
<!--
<p align="center">
  <img src="docs/demo.gif" alt="Footprint Atlas demo" width="800" />
</p>
-->

Drop geotagged travel photos into the project, and Footprint Atlas extracts EXIF metadata (time, GPS) to build an interactive, vintage kraft-paper atlas of everywhere you've been.

It's not a single-trip route planner — it's a growing archive of all the places you've visited. Perfect for organizing years of phone albums, travel photos, and scattered memories.

把带有 EXIF 信息的旅行照片放入项目，Footprint Atlas 会自动提取拍摄时间和 GPS 坐标，生成一张复古手账风格的互动足迹地图。适合整理手机相册、旅行照片和散落在硬盘里的记忆碎片。

## Features

- **EXIF Extraction** — reads shooting time, GPS coordinates, and dimensions from photos
- **Auto Clustering** — groups photos into periods (by month) and footprint stops (by time gaps >6h or distance >12km)
- **Real Map Projection** — renders footprint coordinates on actual world geography via `d3-geo` Mercator projection
- **Vintage Atlas Theme** — kraft-paper texture, hand-journal typography, film-strip photo viewers, wax-seal accents
- **Photo Lightbox** — click any photo for full-viewport viewing with keyboard navigation
- **AI Memory Capsules** — optional vision-model enrichment generates poetic titles, first-person journal notes, mood tags, and color palettes for each stop
- **Unplaced Photo Editor** — geocode search + manual coordinate input for photos without GPS
- **In-Browser Upload** — drag-and-drop photos in dev mode, auto-rebuilds the atlas
- **Static Deployable** — builds to pure static HTML/CSS/JS, ready for GitHub Pages, Vercel, or Cloudflare Pages
- **Local-First Privacy** — all data stays on your machine; no mandatory external services

## Quick Start

```bash
# Clone and install
git clone https://github.com/krrrlww/Footprint-Atlas.git
cd Footprint-Atlas
npm install

# Add your photos
# Put geotagged JPG/PNG/WebP/HEIC files into raw/photos/

# Generate atlas data
npm run album:build

# Start dev server
npm run dev
# → http://localhost:5173
```

Or upload photos directly from the browser after starting the dev server.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (includes local API for editing) |
| `npm run build` | Production build → `dist/` |
| `npm test` | Run unit tests |
| `npm run album:build` | Process `raw/photos/` → generate atlas JSON + optimized images |
| `npm run album:ai` | AI enrichment: generate Memory Capsules + Period Narratives |
| `npm run album:full` | `album:build` + `album:ai` in sequence |
| `npm run album:reset` | Wipe generated data (keeps original photos) |

## AI Enrichment

Footprint Atlas can optionally use a vision model to analyze your photos and generate rich contextual content for each footprint stop:

- **Memory Capsule** — poetic title, first-person journal note, mood descriptor, scene sketch, color palette, tags
- **Period Narrative** — story arc connecting all stops, postcard to your future self

```bash
# Using DeepSeek (default)
AI_API_KEY=sk-xxx npm run album:ai

# Using a custom vision model
AI_API_KEY=sk-xxx AI_VISION_MODEL=gpt-4o AI_VISION_BASE_URL=https://api.openai.com/v1 npm run album:ai
```

See [`.env.example`](.env.example) for all configuration options. AI enrichment is cached in `data/ai-cache.json` — re-running only processes new stops.

You can also configure AI settings from the web UI by clicking the "AI 记忆解析" button.

## Data Model

```
TravelAlbum
  └─ AlbumDay (period — typically a month)
       └─ TimelineStop (footprint cluster)
            └─ MediaItem (photo)
```

Clustering rules:
- Same month, >6h time gap → new stop
- GPS distance >12km → new stop
- Large groups split further by time intervals

## Deploy

### GitHub Pages

Enable GitHub Pages in your repo settings (Settings → Pages → Source: GitHub Actions). The included workflow at `.github/workflows/deploy.yml` will build and deploy on every push to `main`.

Before deploying, make sure `public/album.json` and `public/media/` are committed or generated in CI. For privacy, review that no unwanted photos or coordinates are included.

### Other Platforms

```bash
npm run build
# Upload the dist/ directory to Vercel, Cloudflare Pages, Netlify, or any static host
```

## Privacy

Footprint Atlas is local-first by design:

- Original photos stay in `raw/photos/` (git-ignored)
- Generated images go to `public/media/` (git-ignored)
- EXIF data is organized into local JSON files
- Location search uses Open-Meteo geocoding; manual coordinate input works offline
- AI enrichment is optional and build-time only — the frontend makes zero external API calls

Review `public/media/` and `public/album.json` before any public deployment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Map | `d3-geo`, `world-atlas`, `topojson-client` |
| Photos | `exiftool-vendored`, `sharp` |
| Icons | `lucide-react` |
| AI | Any OpenAI-compatible API (optional, build-time only) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
