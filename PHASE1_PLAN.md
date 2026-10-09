# Phase 1 Implementation Plan

## Project: HTML-to-Figma — Website Capture Engine

### Objective
Build the first working phase of a web app that converts a website URL into structured website data for eventual reconstruction as an editable Figma design.

---

## 1. Project Setup

### Create Next.js App
```bash
npx create-next-app@latest html-to-figma --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### Install Dependencies
```bash
npm install playwright chromium jszip zod
npm install -D vitest @playwright/test @types/node @types/jest @types/jszip
```

### Install Playwright Browsers
```bash
npx playwright install chromium
```

---

## 2. Project Structure

```
html-to-figma/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── api/
│   │   ├── captures/
│   │   │   ├── route.ts          # POST /api/captures
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts      # GET /api/captures/[id]
│   │   │   │   ├── screenshot/
│   │   │   │   │   └── route.ts  # GET /api/captures/[id]/screenshot
│   │   │   │   └── export/
│   │   │   │       └── route.ts  # GET /api/captures/[id]/export
│   │   └── captures/route.ts     # (optional placeholder)
│   ├── capture/
│   │   └── page.tsx              # Capture workspace page
│   └── capture-status/
│       └── page.tsx              # Capture status page
├── components/
│   ├── ui/                       # Reusable UI components
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.css
│   ├── ImportPanel/
│   │   ├── ImportPanel.tsx
│   │   └── ImportPanel.css
│   └── CaptureWorkspace/
│       ├── CaptureWorkspace.tsx
│       └── CaptureWorkspace.css
├── lib/
│   ├── capture.ts                  # Capture engine
│   ├── url-validator.ts            # URL validation
│   ├── zod-schemas.ts              # Zod validation schemas
│   ├── zip-export.ts               # ZIP export
│   ├── storage.ts                  # Local storage
│   └── types.ts                    # TypeScript types
├── schemas/
│   └── capture.schema.ts           # Zod schemas
├── tests/
│   ├── url-validator.test.ts
│   ├── capture-engine.test.ts
│   └── zip-export.test.ts
├── public/
│   └── (static assets)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

---

## 3. Implementation Steps

### Step 1: Type Definitions
- [ ] Create types for PageMetadata, ElementInfo, AssetManifest, CaptureSettings
- [ ] Define capture result interface

### Step 2: URL Validation
- [ ] Create URL validation service
- [ ] Allow HTTP/HTTPS only
- [ ] Reject localhost, loopback, private, link-local, multicast, reserved IPs
- [ ] Block cloud metadata endpoints
- [ ] DNS resolution and validation
- [ ] Redirect destination revalidation
- [ ] DNS rebinding prevention
- [ ] Timeout configuration

### Step 3: Capture Engine (Playwright)
- [ ] Create server-side capture service
- [ ] Validate URL
- [ ] Launch Chromium in headless mode
- [ ] Create isolated browser context
- [ ] Apply viewport
- [ ] Navigate to URL with bounded timeout
- [ ] Wait for DOM ready + rendering stability
- [ ] Record navigation failures and console errors
- [ ] Capture viewport screenshot
- [ ] Optionally capture full-page screenshot
- [ ] Extract page metadata and rendered elements
- [ ] Collect permitted image and font assets
- [ ] Return structured capture results
- [ ] Close browser contexts and cleanup temp files

### Step 4: Data Extraction
- [ ] Extract page metadata (URL, title, description, viewport, timestamps)
- [ ] Extract element info (ID, parent/child, tag, bounding rect, computed styles)
- [ ] Extract asset manifest (URL, type, MIME, download status, path)
- [ ] Create versioned JSON schema

### Step 5: API Endpoints
- [ ] POST /api/captures — start capture
- [ ] GET /api/captures/[id] — get status
- [ ] GET /api/captures/[id]/screenshot — get screenshot
- [ ] GET /api/captures/[id]/export — get ZIP

### Step 6: ZIP Export
- [ ] Create ZIP structure:
  - manifest.json
  - page.json
  - screenshots/viewport.png
  - screenshots/full-page.png (if enabled)
  - assets/
  - README.md

### Step 7: UI Components
- [ ] Dashboard component
- [ ] Import panel component
- [ ] Capture workspace component
- [ ] Loading states for all capture stages
- [ ] Error/warning display

### Step 8: Testing
- [ ] URL validation tests
- [ ] Private IP/redirect rejection tests
- [ ] Unsupported protocol tests
- [ ] Basic HTML extraction tests
- [ ] Text/image/button/layout extraction tests
- [ ] Missing/failed asset tests
- [ ] Screenshot creation tests
- [ ] ZIP content tests

---

## 4. Success Criteria (Definition of Done)

1. App starts locally using documented commands
2. User can submit a public website URL
3. Chromium renders the requested page
4. Screenshot produced and displayed
5. App extracts meaningful DOM structure and computed styles
6. Asset downloads work within defined security limits
7. Extracted JSON is valid and contains parent-child relationships
8. ZIP download works and contains documented files
9. Failure cases produce useful errors and clean up resources
10. Automated tests pass

---

## 5. File Structure (condensed)

### lib/types.ts
- CaptureSettings
- PageMetadata
- ElementInfo
- AssetManifest
- CaptureResult
- ErrorResponse

### lib/url-validator.ts
- isValidPublicUrl(url): boolean
- getResolvedIpAddress(url): string
- isPrivateIp(ip: string): boolean
- isBlockedDestination(url): boolean

### lib/capture.ts
- startCapture(url, settings): Promise<CaptureResult>
- captureUrl(url, settings): Promise<CaptureResult>
- extractElements(page): Promise<ElementInfo[]>
- collectAssets(page, settings): Promise<AssetManifest[]>

### lib/zip-export.ts
- createCaptureZip(result): Promise<Buffer>

### app/api/captures/route.ts
- POST handler

### app/api/captures/[id]/route.ts
- GET handler

### app/api/captures/[id]/screenshot/route.ts
- GET handler

### app/api/captures/[id]/export/route.ts
- GET handler