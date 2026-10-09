# HTML to Figma

A Next.js application that captures a website page and prepares structured data for future Figma reconstruction.

## Run locally

From the repository root:

```bash
npm install
npx playwright install chromium
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

The Next.js app and its `package.json` are in this repository root. Import the repository in Vercel, choose the **Next.js** framework preset, and keep the default build and output settings. Vercel will use `npm run build` (`next build`).

## Important deployment requirements

The capture API launches Playwright/Chromium and saves capture artifacts locally. For production use on Vercel, configure a compatible Chromium runtime or remote browser service and persistent storage for capture files; function-local files are not durable across requests.

See [Phase 1 plan](PHASE1_PLAN.md) and [product roadmap](Phase%20Plan.md).
