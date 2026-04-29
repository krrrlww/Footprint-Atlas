<div align="center">

<img src="public/favicon.svg" width="80" />

# Footprint Atlas

**Turn years of geotagged photos into one living, vintage-styled atlas.**

[Live Demo](https://krrrlww.github.io/Footprint-Atlas/) · [Quick Start](#quick-start) · [AI Enrichment](#-ai-enrichment) · [Deploy](#-deploy)

[![MIT License](https://img.shields.io/github/license/krrrlww/Footprint-Atlas?color=8e3f39&labelColor=3b3023)](LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-8e3f39?labelColor=3b3023)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/react-19-8e3f39?labelColor=3b3023)](https://react.dev/)

</div>

---

Drop travel photos in. Get a kraft-paper atlas out.

Footprint Atlas reads EXIF metadata — shooting time, GPS — from every photo you give it, then clusters them by month and geography into an interactive, zoomable world map. It's not a single-trip route planner; it's a growing archive of everywhere you've been.

把旅行照片放进来，生成一本复古手账风格的足迹地图集。自动提取 EXIF 时间和 GPS 坐标，按月份和地理位置聚合，支持 AI 为每个足迹点撰写诗意标题和第一人称手账旁注。

## ✦ What It Does

| | Feature | |
|---|---|---|
| 🗺️ | **Real Map Projection** | d3-geo Mercator on actual world geography — zoom, pan, drag |
| 📍 | **Auto Clustering** | Groups photos into periods (by month) and stops (by time >6h / distance >12km) |
| 📷 | **EXIF Extraction** | Reads time, GPS, dimensions from JPG / PNG / WebP / HEIC / TIFF |
| 🤖 | **AI Memory Capsules** | Vision model generates poetic titles, journal notes, mood tags, color palettes |
| ✉️ | **Period Narratives** | AI writes a story arc + postcard-to-future-self for each travel period |
| 🔍 | **Photo Lightbox** | Click any photo → full-viewport viewer with keyboard navigation |
| 🏷️ | **Unplaced Editor** | Geocode search + manual coordinates for photos without GPS |
| 📤 | **Browser Upload** | Drag-and-drop in dev mode, auto-rebuilds the atlas |
| 🔒 | **Local-First** | All data on your machine. Zero external calls from the frontend |

## Quick Start

```bash
git clone https://github.com/krrrlww/Footprint-Atlas.git
cd Footprint-Atlas && npm install

# Drop geotagged photos into raw/photos/, then:
npm run album:build          # extract EXIF → generate atlas
npm run dev                  # → http://localhost:5173
```

Or start the dev server first and upload photos from the browser.

<details>
<summary><strong>All scripts</strong></summary>

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server + local editing API |
| `npm run build` | Production build → `dist/` |
| `npm test` | Unit tests |
| `npm run album:build` | `raw/photos/` → optimized images + `album.json` |
| `npm run album:ai` | AI enrichment (Memory Capsules + Narratives) |
| `npm run album:full` | `album:build` then `album:ai` |
| `npm run album:reset` | Wipe generated data, keep originals |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

</details>

## 🤖 AI Enrichment

Optionally connect a vision model to generate rich context for every stop:

- **Memory Capsule** — poetic title · first-person journal note · mood · scene sketch · color palette · tags
- **Period Narrative** — story arc connecting all stops · postcard to your future self

```bash
AI_API_KEY=sk-xxx npm run album:ai                    # DeepSeek (default)
AI_API_KEY=sk-xxx AI_VISION_MODEL=gpt-4o \
  AI_VISION_BASE_URL=https://api.openai.com/v1 \
  npm run album:ai                                     # OpenAI
```

Results are cached in `data/ai-cache.json` — re-runs only process new stops. You can also configure everything from the web UI (click **AI 记忆解析**).

See [`.env.example`](.env.example) for all options.

## 📐 Data Model

```
TravelAlbum
  └─ AlbumDay          (period — typically one month)
       └─ TimelineStop  (footprint cluster: >6h gap or >12km apart)
            └─ MediaItem (single photo)
```

## 🚀 Deploy

**GitHub Pages** — already set up. Enable Pages (Settings → Pages → Source: GitHub Actions), push to `main`, done. The included workflow builds and deploys automatically.

**Anywhere else** — `npm run build`, upload `dist/` to Vercel / Cloudflare Pages / Netlify / any static host.

> Before public deployment, review `public/media/` and `public/album.json` for any photos or coordinates you'd rather keep private.

## 🔧 Tech Stack

| | |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite |
| **Map** | d3-geo · world-atlas · topojson-client |
| **Photos** | exiftool-vendored · sharp |
| **Icons** | lucide-react |
| **AI** | Any OpenAI-compatible API (optional, build-time only) |
| **CI/CD** | GitHub Actions · ESLint · Prettier |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](LICENSE)
