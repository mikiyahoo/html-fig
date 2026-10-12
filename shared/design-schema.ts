/** Shared wire contract consumed by the web converter and the Figma plugin. */
export const DESIGN_SCHEMA_VERSION = "1.0.0" as const;

export interface DesignColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type DesignFill = DesignColor | {
  type: "LINEAR_GRADIENT";
  angle: number;
  stops: Array<{ position: number; color: DesignColor }>;
};

export interface DesignBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DesignNodeType = "FRAME" | "TEXT" | "IMAGE" | "RECTANGLE" | "ELLIPSE";

export interface DesignNode {
  id: string;
  sourceElementId: string;
  name: string;
  type: DesignNodeType;
  bounds: DesignBounds;
  fills: DesignFill[];
  strokes: DesignColor[];
  strokeWidth: number;
  cornerRadius: number;
  opacity: number;
  children: DesignNode[];
  layout?: {
    mode: "NONE" | "HORIZONTAL" | "VERTICAL";
    gap: number;
    padding: { top: number; right: number; bottom: number; left: number };
    alignItems: string;
    justifyContent: string;
  };
  text?: string;
  textStyle?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number | null;
    textAlign: string;
    color: DesignColor | null;
  };
  image?: {
    sourceUrl: string;
    packagePath: string | null;
    alt: string;
  };
}

export interface DesignDocument {
  schemaVersion: typeof DESIGN_SCHEMA_VERSION;
  captureId: string;
  sourceUrl: string;
  pageTitle: string;
  viewport: { width: number; height: number };
  root: DesignNode;
  warnings: string[];
}

/** Runtime validation for packages before the plugin writes nodes into a document. */
export function isDesignDocument(value: unknown): value is DesignDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<DesignDocument>;
  return doc.schemaVersion === DESIGN_SCHEMA_VERSION
    && typeof doc.captureId === "string"
    && typeof doc.sourceUrl === "string"
    && typeof doc.pageTitle === "string"
    && !!doc.viewport && Number.isFinite(doc.viewport.width) && Number.isFinite(doc.viewport.height)
    && Array.isArray(doc.warnings)
    && isDesignNode(doc.root);
}

function isDesignNode(value: unknown): value is DesignNode {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<DesignNode>;
  return typeof node.id === "string"
    && typeof node.sourceElementId === "string"
    && typeof node.name === "string"
    && ["FRAME", "TEXT", "IMAGE", "RECTANGLE", "ELLIPSE"].includes(node.type || "")
    && !!node.bounds
    && [node.bounds.x, node.bounds.y, node.bounds.width, node.bounds.height].every(Number.isFinite)
    && Array.isArray(node.fills)
    && Array.isArray(node.strokes)
    && Array.isArray(node.children)
    && node.children.every(isDesignNode);
}
