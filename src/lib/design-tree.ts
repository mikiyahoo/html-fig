import type { AssetManifest, CaptureResult, ElementInfo } from "./types";
import { DESIGN_SCHEMA_VERSION, type DesignColor, type DesignDocument, type DesignNode } from "../../shared/design-schema";

export type { DesignColor, DesignDocument, DesignNode } from "../../shared/design-schema";

const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "li", "td", "th", "input", "textarea",
]);
const BUTTON_TAGS = new Set(["a", "button"]);

/** Convert captured DOM/style records into a stable, versioned design representation. */
export function buildDesignTree(capture: CaptureResult): DesignDocument {
  const warnings = new Set<string>();
  const childrenByParent = new Map<string | null, ElementInfo[]>();
  for (const element of capture.elements) {
    const siblings = childrenByParent.get(element.parentId) ?? [];
    siblings.push(element);
    childrenByParent.set(element.parentId, siblings);
  }

  const assetByUrl = new Map<string, AssetManifest>();
  for (const asset of capture.assets) assetByUrl.set(normalizeUrl(asset.originalUrl), asset);

  const buildNode = (element: ElementInfo, parent: ElementInfo | null, index: number): DesignNode => {
    const isButton = BUTTON_TAGS.has(element.tag);
    const isImage = element.tag === "img";
    const isText = TEXT_TAGS.has(element.tag) && !isButton;
    const isEllipse = isCircularShape(element);
    const isShape = element.tag === "hr" || isEllipse;
    const type: DesignNode["type"] = isImage ? "IMAGE" : isText ? "TEXT" : isShape ? (isEllipse ? "ELLIPSE" : "RECTANGLE") : "FRAME";
    const rect = element.boundingRect;
    const parentRect = parent?.boundingRect;
    const text = (element.textContent || "").trim();
    const name = makeNodeName(element, index, text);
    const background = parseCssColor(element.backgroundColor);
    const textColor = parseCssColor(element.color);
    const borderWidth = parsePixels(element.borderWidth);
    const borderColor = element.borderStyle === "none" ? null : parseCssColor(element.borderColor);
    const rawChildren = childrenByParent.get(element.id) ?? [];
    const nestedChildren = isText || isShape
      ? []
      : rawChildren
          .filter((child) => !(isButton && TEXT_TAGS.has(child.tag)))
          .map((child, childIndex) => buildNode(child, element, childIndex + 1));
    const node: DesignNode = {
      id: `node-${element.id}`,
      sourceElementId: element.id,
      name,
      type,
      bounds: {
        x: Math.round(rect.x - (parentRect?.x ?? 0)),
        y: Math.round(rect.y - (parentRect?.y ?? 0)),
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      },
      fills: background && background.a > 0 ? [background] : [],
      strokes: borderWidth > 0 && borderColor ? [borderColor] : [],
      strokeWidth: borderWidth,
      cornerRadius: parsePixels(element.borderRadius),
      opacity: clamp(parseFloat(element.opacity) || 1, 0, 1),
      children: nestedChildren,
    };

    if (type === "FRAME") {
      node.layout = getLayout(element, warnings, name);
      if (isButton && text) {
        node.children.unshift(makeTextChild(element, text, textColor));
      }
    }
    if (type === "TEXT") {
      node.text = text;
      node.textStyle = {
        fontFamily: element.fontFamily,
        fontSize: parsePixels(element.fontSize),
        fontWeight: parseFontWeight(element.fontWeight),
        lineHeight: element.lineHeight === "normal" ? null : parsePixels(element.lineHeight),
        textAlign: element.textAlign,
        color: textColor,
      };
    }
    if (isImage) {
      const sourceUrl = element.imageSrc || "";
      const asset = assetByUrl.get(normalizeUrl(sourceUrl));
      node.image = {
        sourceUrl,
        packagePath: asset?.downloadStatus === "success" ? asset.localPath : null,
        alt: element.alt || "",
      };
      if (!node.image.packagePath) warnings.add(`Image asset is not packaged: ${element.alt || sourceUrl || name}`);
    }
    const backgroundImage = element.cssProperties["background-image"];
    if (backgroundImage && backgroundImage !== "none") warnings.add(`Background image or gradient is not converted to a native fill: ${name}`);
    if (element.display === "grid") warnings.add(`Grid layout is represented with positioned nodes: ${name}`);
    if (element.boxShadow && element.boxShadow !== "none") warnings.add(`Box shadow is not converted to a native effect: ${name}`);
    for (const property of ["transform", "filter", "clip-path", "mask-image", "mix-blend-mode", "backdrop-filter"]) {
      const value = element.cssProperties[property];
      if (value && value !== "none" && value !== "normal") warnings.add(`${property} is not converted: ${name}`);
    }
    return node;
  };

  const rootElement: ElementInfo = {
    id: "root",
    parentId: null,
    tag: "main",
    role: "document",
    textContent: "",
    boundingRect: {
      x: 0,
      y: 0,
      width: capture.pageMetadata.scrollWidth || capture.pageMetadata.viewportWidth,
      height: capture.pageMetadata.scrollHeight || capture.pageMetadata.viewportHeight,
    },
    display: "block",
    position: "static",
    flexDirection: null,
    flexWrap: null,
    justifyContent: null,
    alignItems: null,
    gridTemplateColumns: null,
    gridTemplateRows: null,
    padding: "0px",
    margin: "0px",
    gap: "0px",
    fontFamily: "",
    fontSize: "16px",
    fontWeight: "400",
    lineHeight: "normal",
    textAlign: "left",
    color: "transparent",
    backgroundColor: "transparent",
    borderWidth: "0px",
    borderStyle: "none",
    borderColor: "transparent",
    borderRadius: "0px",
    boxShadow: "none",
    opacity: "1",
    imageSrc: null,
    alt: null,
    visibility: "visible",
    zIndex: null,
    cssProperties: {},
  };

  const root: DesignNode = {
    id: `page-${capture.id}`,
    sourceElementId: "root",
    name: capture.pageMetadata.title || "Captured Page",
    type: "FRAME",
    bounds: { x: 0, y: 0, width: rootElement.boundingRect.width, height: rootElement.boundingRect.height },
    fills: [],
    strokes: [],
    strokeWidth: 0,
    cornerRadius: 0,
    opacity: 1,
    layout: { mode: "NONE", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, alignItems: "start", justifyContent: "start" },
    children: (childrenByParent.get(null) ?? []).map((element, index) => buildNode(element, null, index + 1)),
  };

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    captureId: capture.id,
    sourceUrl: capture.finalUrl,
    pageTitle: capture.pageMetadata.title,
    viewport: { width: capture.pageMetadata.viewportWidth, height: capture.pageMetadata.viewportHeight },
    root,
    warnings: [...warnings],
  };
}

function makeTextChild(source: ElementInfo, text: string, color: DesignColor | null): DesignNode {
  return {
    id: `node-${source.id}-text`,
    sourceElementId: source.id,
    name: `${source.tag === "button" ? "Button" : "Link"} Text`,
    type: "TEXT",
    bounds: { x: 0, y: 0, width: source.boundingRect.width, height: source.boundingRect.height },
    fills: [],
    strokes: [],
    strokeWidth: 0,
    cornerRadius: 0,
    opacity: 1,
    children: [],
    text,
    textStyle: {
      fontFamily: source.fontFamily,
      fontSize: parsePixels(source.fontSize),
      fontWeight: parseFontWeight(source.fontWeight),
      lineHeight: source.lineHeight === "normal" ? null : parsePixels(source.lineHeight),
      textAlign: source.textAlign,
      color,
    },
  };
}

function getLayout(element: ElementInfo, warnings: Set<string>, name: string): NonNullable<DesignNode["layout"]> {
  const mode = element.display === "flex"
    ? element.flexDirection?.startsWith("column") ? "VERTICAL" : "HORIZONTAL"
    : "NONE";
  if (element.display === "grid") warnings.add(`Grid layout is represented with positioned nodes: ${name}`);
  return {
    mode,
    gap: parsePixels(element.gap),
    padding: {
      top: parsePixels(element.cssProperties["padding-top"] || element.padding),
      right: parsePixels(element.cssProperties["padding-right"] || element.padding),
      bottom: parsePixels(element.cssProperties["padding-bottom"] || element.padding),
      left: parsePixels(element.cssProperties["padding-left"] || element.padding),
    },
    alignItems: element.alignItems || "start",
    justifyContent: element.justifyContent || "start",
  };
}

function makeNodeName(element: ElementInfo, index: number, text: string): string {
  const label = text.replace(/\s+/g, " ").slice(0, 36);
  const semantic = element.tag === "img" ? "Image" : element.tag === "button" ? "Button" : element.tag === "a" ? "Link" : element.tag.toUpperCase();
  return label ? `${semantic} — ${label}` : `${semantic} ${index}`;
}

function isCircularShape(element: ElementInfo): boolean {
  const { width, height } = element.boundingRect;
  if (!width || !height || Math.abs(width - height) > 2) return false;
  return /(?:50%|(?:\d+(?:\.\d+)?px))/.test(element.borderRadius)
    && (element.borderRadius.includes("50%") || parsePixels(element.borderRadius) >= Math.min(width, height) / 2 - 1);
}

function parseCssColor(value: string | null | undefined): DesignColor | null {
  if (!value || value === "transparent") return null;
  const match = value.match(/^rgba?\((.+)\)$/i);
  if (!match) return null;
  const parts = match[1].replace(/,/g, " ").replace(/\s*\/\s*/g, " ").trim().split(/\s+/);
  if (parts.length < 3) return null;
  const channel = (part: string) => clamp(parseFloat(part) / (part.endsWith("%") ? 100 : 255), 0, 1);
  const alphaPart = parts[3];
  const alpha = alphaPart ? clamp(parseFloat(alphaPart) / (alphaPart.endsWith("%") ? 100 : 1), 0, 1) : 1;
  return { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha };
}

function parsePixels(value: string | null | undefined): number {
  const match = value?.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parseFontWeight(value: string): number {
  if (value === "bold") return 700;
  const weight = Number.parseInt(value, 10);
  return Number.isFinite(weight) ? weight : 400;
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
