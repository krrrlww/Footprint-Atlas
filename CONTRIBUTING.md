# Contributing to Footprint Atlas

Thanks for your interest! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/krrrlww/Footprint-Atlas.git
cd Footprint-Atlas
npm install
npm run dev
```

Put some geotagged photos in `raw/photos/`, then:

```bash
npm run album:build   # generate atlas data
npm run album:ai      # optional: AI enrichment (requires API key)
```

## Before Submitting a PR

```bash
npx tsc --noEmit --skipLibCheck   # type check
npm run build                      # production build
npm test                           # unit tests
```

## Project Structure

```
scripts/           Node scripts (data pipeline, AI enrichment)
src/components/    React components
src/lib/           Geo utilities, map projection, album helpers
src/styles/        Single CSS file (vintage atlas theme)
src/types/         TypeScript type definitions
```

## Guidelines

- Keep the app local-first — no mandatory external services
- AI features are build-time only; the frontend has zero AI dependency
- UI text is bilingual: structural labels in English, descriptions in Chinese
- Styling lives in `src/styles/app.css` using HSL-based CSS custom properties
- Prefer CSS-only solutions for animations and visual effects

## Reporting Issues

Use the [issue templates](https://github.com/krrrlww/Footprint-Atlas/issues/new/choose) — they help us understand and reproduce the problem faster.
