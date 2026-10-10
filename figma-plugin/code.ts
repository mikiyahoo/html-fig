import type { DesignColor, DesignDocument, DesignNode } from "../shared/design-schema";
const SUPPORTED_SCHEMA_VERSION: DesignDocument["schemaVersion"] = "1.0.0";

type ImportMessage = {
  type: "import";
  pages: Array<{ design: DesignDocument; assets: Record<string, Uint8Array> }>;
};

let importWarnings = new Set<string>();

figma.showUI(__html__, { width: 420, height: 520, title: "Web to Figma Importer", themeColors: true });

figma.ui.onmessage = async (message: ImportMessage | { type: "cancel" }) => {
  if (message.type === "cancel") {
    figma.closePlugin();
    return;
  }
  if (message.type !== "import") return;

  try {
    if (!message.pages.length) throw new Error("No design pages were found in this ZIP.");
    const roots: FrameNode[] = [];
    let layerCount = 0;
    const notes: string[] = [];
    importWarnings = new Set();
    for (const [index, page] of message.pages.entries()) {
      validateDesign(page.design);
      figma.ui.postMessage({ type: "progress", text: `Creating page ${index + 1} of ${message.pages.length}…` });
      const root = await createDesignNode(page.design.root, page.assets, true) as FrameNode;
      figma.currentPage.appendChild(root);
      root.x = Math.round(figma.viewport.center.x - root.width / 2 + index * (root.width + 80));
      root.y = Math.round(figma.viewport.center.y - root.height / 2);
      const title = page.design.pageTitle || `Imported Page ${index + 1}`;
      const viewport = page.design.viewport;
      root.name = viewport
        ? `${title} — ${viewportLabel(viewport.width)} (${viewport.width} × ${viewport.height})`
        : title;
      roots.push(root);
      layerCount += countNodes(page.design.root);
      notes.push(...page.design.warnings);
    }
    figma.viewport.scrollAndZoomIntoView(roots);
    figma.ui.postMessage({ type: "complete", text: `Created ${message.pages.length} editable page layout(s) with ${layerCount} native layers. The document is ready in Figma.` });
    notes.push(...importWarnings);
    if (notes.length) figma.ui.postMessage({ type: "warnings", warnings: [...new Set(notes)] });
    figma.ui.postMessage({ type: "save-instructions", text: "To download a genuine .fig file, use Figma’s File → Save local copy. This plugin does not create or rename a .fig export." });
  } catch (error) {
    figma.ui.postMessage({ type: "error", text: error instanceof Error ? error.message : "Import failed." });
  }
};

function validateDesign(design: unknown): asserts design is DesignDocument {
  if (!design || typeof design !== "object") throw new Error("This package does not contain a design document.");
  const document = design as Partial<DesignDocument>;
  if (document.schemaVersion !== SUPPORTED_SCHEMA_VERSION || !document.root || document.root.type !== "FRAME") {
    throw new Error("This ZIP does not contain a supported design.json file.");
  }
  if (!Number.isFinite(document.root.bounds.width) || !Number.isFinite(document.root.bounds.height) || !Array.isArray(document.root.children)) {
    throw new Error("The design tree has invalid page dimensions.");
  }
}

async function createDesignNode(node: DesignNode, assets: Record<string, Uint8Array>, isRoot = false): Promise<SceneNode> {
  if (node.type === "TEXT") {
    const text = figma.createText();
    text.name = node.name;
    const loadedFont = await loadFont(node.textStyle?.fontFamily || "Inter", node.textStyle?.fontWeight || 400);
    text.fontName = loadedFont;
    text.characters = node.text || " ";
    text.fontSize = Math.max(1, node.textStyle?.fontSize || 16);
    text.textAlignHorizontal = textAlign(node.textStyle?.textAlign || "left");
    text.fills = node.textStyle?.color ? [toSolidPaint(node.textStyle.color)] : [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    text.opacity = clamp(node.opacity, 0, 1);
    text.resize(Math.max(1, node.bounds.width), Math.max(1, node.bounds.height));
    text.x = node.bounds.x;
    text.y = node.bounds.y;
    return text;
  }

  if (node.type === "IMAGE") {
    const packagePath = node.image?.packagePath;
    const bytes = packagePath ? assets[packagePath] : undefined;
    if (bytes) {
      const extension = packagePath?.split(".").pop()?.toLowerCase();
      if (extension === "svg") {
        try {
          const svgFrame = figma.createNodeFromSvg(new TextDecoder().decode(bytes));
          svgFrame.name = node.name;
          svgFrame.resize(Math.max(1, node.bounds.width), Math.max(1, node.bounds.height));
          svgFrame.x = node.bounds.x;
          svgFrame.y = node.bounds.y;
          svgFrame.opacity = clamp(node.opacity, 0, 1);
          return svgFrame;
        } catch {
          reportWarning(`SVG asset could not be imported as a vector: ${node.name}`);
        }
      }
      try {
        const image = figma.createImage(bytes);
        const rect = figma.createRectangle();
        rect.name = node.name;
        rect.resize(Math.max(1, node.bounds.width), Math.max(1, node.bounds.height));
        rect.x = node.bounds.x;
        rect.y = node.bounds.y;
        rect.opacity = clamp(node.opacity, 0, 1);
        rect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
        return rect;
      } catch {
        // Preserve a visible placeholder if the source image format is unsupported by Figma.
      }
    }
    reportWarning(`Image asset is unavailable or unsupported: ${node.name}${node.image?.alt ? ` (${node.image.alt})` : ""}`);
  }

  if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
    const shape = node.type === "ELLIPSE" ? figma.createEllipse() : figma.createRectangle();
    shape.name = node.name;
    shape.resize(Math.max(1, node.bounds.width), Math.max(1, node.bounds.height));
    shape.x = node.bounds.x;
    shape.y = node.bounds.y;
    shape.opacity = clamp(node.opacity, 0, 1);
    shape.fills = node.fills.map(toSolidPaint);
    shape.strokes = node.strokes.map(toSolidPaint);
    shape.strokeWeight = Math.max(0, node.strokeWidth);
    if (node.type === "RECTANGLE") shape.cornerRadius = Math.max(0, node.cornerRadius);
    return shape;
  }

  const frame = figma.createFrame();
  frame.name = node.name;
  frame.resize(Math.max(1, node.bounds.width), Math.max(1, node.bounds.height));
  frame.x = node.bounds.x;
  frame.y = node.bounds.y;
  frame.opacity = clamp(node.opacity, 0, 1);
  frame.fills = node.fills.map(toSolidPaint);
  frame.strokes = node.strokes.map(toSolidPaint);
  frame.strokeWeight = Math.max(0, node.strokeWidth);
  frame.cornerRadius = Math.max(0, node.cornerRadius);
  if (isRoot || !node.layout || node.layout.mode === "NONE") {
    frame.layoutMode = "NONE";
  } else {
    applyAutoLayout(frame, node.layout);
  }

  for (const child of node.children || []) {
    const childNode = await createDesignNode(child, assets);
    frame.appendChild(childNode);
  }
  return frame;
}

async function loadFont(cssFamily: string, weight: number): Promise<FontName> {
  const family = cssFamily.split(",")[0].trim().replace(/["']/g, "") || "Inter";
  const style = weight >= 700 ? "Bold" : weight >= 600 ? "Semi Bold" : weight <= 300 ? "Light" : "Regular";
  try {
    const requested = { family, style };
    await figma.loadFontAsync(requested);
    return requested;
  } catch {
    const fallback = { family: "Inter", style: "Regular" };
    await figma.loadFontAsync(fallback);
    reportWarning(`Font “${family} ${style}” is unavailable in this Figma file; Inter Regular was used.`);
    return fallback;
  }
}

function applyAutoLayout(frame: FrameNode, layout: NonNullable<DesignNode["layout"]>): void {
  frame.layoutMode = layout.mode;
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  frame.itemSpacing = Math.max(0, layout.gap);
  frame.paddingTop = Math.max(0, layout.padding.top);
  frame.paddingRight = Math.max(0, layout.padding.right);
  frame.paddingBottom = Math.max(0, layout.padding.bottom);
  frame.paddingLeft = Math.max(0, layout.padding.left);
  frame.primaryAxisAlignItems = axisAlignment(layout.justifyContent);
  frame.counterAxisAlignItems = counterAxisAlignment(layout.alignItems);
}

function axisAlignment(value: string): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" {
  if (value === "center") return "CENTER";
  if (value === "flex-end" || value === "end") return "MAX";
  if (value === "space-between") return "SPACE_BETWEEN";
  return "MIN";
}

function counterAxisAlignment(value: string): "MIN" | "CENTER" | "MAX" | "BASELINE" {
  if (value === "center") return "CENTER";
  if (value === "flex-end" || value === "end") return "MAX";
  if (value === "baseline") return "BASELINE";
  return "MIN";
}

function textAlign(value: string): "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" {
  if (value === "center") return "CENTER";
  if (value === "right" || value === "end") return "RIGHT";
  if (value === "justify") return "JUSTIFIED";
  return "LEFT";
}

function toSolidPaint(color: DesignColor): SolidPaint {
  return { type: "SOLID", color: { r: color.r, g: color.g, b: color.b }, opacity: clamp(color.a, 0, 1) };
}

function countNodes(node: DesignNode, type?: DesignNode["type"]): number {
  return (type ? Number(node.type === type) : 1) + (node.children || []).reduce((count, child) => count + countNodes(child, type), 0);
}

function reportWarning(message: string): void {
  importWarnings.add(message);
}

function viewportLabel(width: number): string {
  if (width <= 480) return "Mobile";
  if (width <= 1024) return "Tablet";
  return "Desktop";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
