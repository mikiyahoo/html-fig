// Capture settings
export interface CaptureSettings {
  url: string;
  viewport: "desktop" | "tablet" | "mobile";
  fullPageScreenshot: boolean;
  captureAssets: boolean;
  captureSchemaVersion: number;
}

// Page metadata
export interface PageMetadata {
  originalUrl: string;
  finalUrl: string;
  title: string;
  description: string;
  viewportWidth: number;
  viewportHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  captureTimestamp: string;
  captureSchemaVersion: number;
  userAgent: string;
  languages: string[];
}

// Element info
export interface ElementInfo {
  id: string;
  parentId: string | null;
  tag: string;
  role: string;
  textContent: string;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  display: string;
  position: string;
  flexDirection: string | null;
  flexWrap: string | null;
  justifyContent: string | null;
  alignItems: string | null;
  gridTemplateColumns: string | null;
  gridTemplateRows: string | null;
  padding: string;
  margin: string;
  gap: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  textAlign: string;
  color: string;
  backgroundColor: string;
  borderWidth: string;
  borderStyle: string;
  borderColor: string;
  borderRadius: string;
  boxShadow: string;
  opacity: string;
  imageSrc: string | null;
  alt: string | null;
  visibility: string;
  zIndex: string | null;
  cssProperties: Record<string, string>;
}

// Asset manifest
export interface AssetManifest {
  originalUrl: string;
  assetType: "image" | "svg" | "font" | "other";
  mimeType: string;
  downloadStatus: "success" | "failed" | "skipped";
  localPath: string | null;
  fileName: string;
  fileSize: number | null;
  altText: string | null;
  contentHash: string | null;
}

// Capture result
export interface CaptureResult {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  originalUrl: string;
  finalUrl: string;
  pageMetadata: PageMetadata;
  elements: ElementInfo[];
  assets: AssetManifest[];
  screenshot?: {
    width: number;
    height: number;
    format: string;
    path: string;
  };
  fullPageScreenshot?: {
    width: number;
    height: number;
    format: string;
    path: string;
  };
  warnings: string[];
  errors: string[];
  captureTimestamp: string;
  captureSettings: CaptureSettings;
  manifest: {
    captureVersion: string;
    sourceUrl: string;
    timestamp: string;
    assetList: AssetManifest[];
    captureSettings: CaptureSettings;
    warnings: string[];
    packageContents: string[];
  };
  /** Internal transfer buffer, removed before the capture is serialized to disk or returned to clients. */
  assetFiles?: Record<string, string>;
}

// Capture status for API
export type CaptureState = "idle" | "pending" | "running" | "completed" | "failed";

export interface CaptureStatus {
  id: string;
  batchId?: string;
  originalUrl: string;
  state: CaptureState;
  progress: string;
  errors: string[];
  warnings: string[];
  screenshotUrl: string | null;
  pageTitle?: string;
  pageCount?: number;
  assetCount?: number;
  elapsedTime: number;
  startedAt: string | null;
  completedAt: string | null;
}

// Error response
export interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}

// ZIP export format
export interface ZipEntry {
  name: string;
  type: "file" | "directory" | "screenshot" | "asset";
  path: string;
  size: number;
}
