# HTML to Figma - Website Capture Engine

A Next.js web application that converts a website URL into structured website data for eventual reconstruction as an editable Figma design.

## Phase 1: Website Capture Engine

This is Phase 1 of the project, focused on capturing one page:

- **URL Import**: Accept and validate a website URL (HTTP/HTTPS only, security hardened)
- **Browser Rendering**: Use Playwright and Chromium to render the page
- **Page Extraction**: Collect DOM structure, computed styles, fonts, colors, images
- **Capture Package**: Save screenshot, extracted JSON, and downloaded assets

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Playwright Setup

```bash
npx playwright install chromium
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── captures/route.ts          # POST /api/captures
│   │   ├── captures/[id]/route.ts     # GET /api/captures/[id]
│   │   ├── captures/[id]/screenshot/route.ts
│   │   └── captures/[id]/export/route.ts
│   ├── page.tsx                       # Main app page
│   └── layout.tsx
├── components/
│   ├── Dashboard/
│   ├── ImportPanel/
│   └── CaptureWorkspace/
├── lib/
│   ├── capture.ts                     # Playwright capture engine
│   ├── storage.ts                     # Local storage
│   ├── types.ts                       # TypeScript types
│   └── url-validator.ts               # URL validation
├── schemas/
│   └── capture.schema.ts
└── tests/
    └── url-validator.test.ts
```

## API Endpoints

- `POST /api/captures` - Start a capture
- `GET /api/captures/[id]` - Get capture status
- `GET /api/captures/[id]/screenshot` - Get capture screenshot
- `GET /api/captures/[id]/export` - Download capture ZIP

## Testing

```bash
npm run test          # Run tests
npm run test:watch    # Run tests in watch mode
```

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Browser Automation**: Playwright with Chromium
- **Validation**: Zod
- **File Packaging**: JSZip
- **Testing**: Vitest and Playwright