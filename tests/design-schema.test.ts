import { describe, expect, it } from "vitest";
import { DESIGN_SCHEMA_VERSION, isDesignDocument, type DesignDocument } from "../shared/design-schema";

const document: DesignDocument = {
  schemaVersion: DESIGN_SCHEMA_VERSION,
  captureId: "capture-1",
  sourceUrl: "https://example.com/",
  pageTitle: "Example",
  viewport: { width: 1280, height: 720 },
  root: {
    id: "page-1",
    sourceElementId: "root",
    name: "Example",
    type: "FRAME",
    bounds: { x: 0, y: 0, width: 1280, height: 720 },
    fills: [],
    strokes: [],
    strokeWidth: 0,
    cornerRadius: 0,
    opacity: 1,
    children: [],
  },
  warnings: [],
};

describe("shared Figma design schema", () => {
  it("accepts a valid versioned design document", () => {
    expect(isDesignDocument(document)).toBe(true);
  });

  it("rejects incompatible versions and incomplete node bounds", () => {
    expect(isDesignDocument({ ...document, schemaVersion: "2.0.0" })).toBe(false);
    expect(isDesignDocument({ ...document, root: { ...document.root, bounds: { x: 0, y: 0, width: Number.NaN, height: 1 } } })).toBe(false);
  });
});
