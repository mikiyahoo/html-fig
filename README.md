# HTML to Figma

A Next.js application that captures a website page and prepares structured data for future Figma reconstruction.

## Implementation status

- Phase 1: Chromium capture, extracted DOM/style data, assets, screenshots, and ZIP export.
- Phase 2: Versioned design tree with layout and styling hints in `design.json`.
- Phase 3: Companion Figma plugin that imports editable frames, text, and packaged images.
- Phase 4: Same-origin page discovery, selection, multi-page capture, and one website ZIP.

The plugin creates nodes inside Figma; the web app does not generate a `.fig` file. Grid layout, CSS backgrounds, complex effects, and some image/font formats are represented with warnings or simplified nodes.

## Run locally

From the repository root:

```bash
npm install
npx playwright install chromium
npm run dev
```

Open `http://localhost:3000`.

Capture data is stored under `temp/captures` and expires after seven days by default. Set `STORAGE_DIR` to choose another local path or `CAPTURE_RETENTION_DAYS` to change the retention period. Expired page captures and batch manifests are cleaned during capture and recent-project requests.

## Deploy to Vercel

The Next.js app and its `package.json` are in this repository root. Import the repository in Vercel, choose the **Next.js** framework preset, and keep the default build and output settings. Vercel will use `npm run build` (`next build`).

## Important deployment requirements

The capture API launches Playwright/Chromium and saves capture artifacts locally. For production use on Vercel, configure a compatible Chromium runtime or remote browser service and persistent storage for capture files; function-local files are not durable across requests.

See [Phase 1 plan](PHASE1_PLAN.md) and [product roadmap](Phase%20Plan.md).

## Figma plugin

Single-page and website ZIPs include `design.json`. Build and load the companion plugin by following [figma-plugin/README.md](figma-plugin/README.md). The plugin supports both ZIP formats and creates one frame per page.
