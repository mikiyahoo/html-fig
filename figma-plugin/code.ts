interface DesignColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface DesignNode {
  id: string;
  name: string;
  type: "FRAME" | "TEXT" | "IMAGE";
  bounds: { x: number; y: number; width: number; height: number };
  fills: DesignColor[];
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
  image?: { sourceUrl: string; packagePath: string | null; alt: string };
}

interface DesignDocument {
  schemaVersion: string;
  captureId: string;
  sourceUrl: string;
  pageTitle: string;
  viewport?: { width: number; height: number };
  root: DesignNode;
  warnings: string[];
}

type ImportMessage = {
  type: "import";
  pages: Array<{ design: DesignDocument; assets: Record<string, Uint8Array> }>;
};

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
    let imageCount = 0;
    const notes: string[] = [];
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
      imageCount += countNodes(page.design.root, "IMAGE");
      notes.push(...page.design.warnings);
    }
    figma.viewport.scrollAndZoomIntoView(roots);
    figma.ui.postMessage({ type: "complete", text: `Imported ${message.pages.length} page layout(s) and ${layerCount} editable layers.` });
    if (notes.length || imageCount) {
      if (imageCount) notes.push("Image layers are included where their packaged files use PNG, JPEG, GIF, or SVG.");
      figma.ui.postMessage({ type: "warnings", warnings: notes });
    }
  } catch (error) {
    figma.ui.postMessage({ type: "error", text: error instanceof Error ? error.message : "Import failed." });
  }
};

function validateDesign(design: DesignDocument): void {
  if (!design || design.schemaVersion !== "1.0.0" || !design.root || design.root.type !== "FRAME") {
    throw new Error("This ZIP does not contain a supported design.json file.");
  }
  if (!Number.isFinite(design.root.bounds.width) || !Number.isFinite(design.root.bounds.height)) {
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

  if (node.type === "IMAGE" && node.image?.packagePath) {
    const bytes = assets[node.image.packagePath];
    if (bytes) {
      const extension = node.image.packagePath.split(".").pop()?.toLowerCase();
      if (extension === "svg") {
        const svgFrame = figma.createNodeFromSvg(new TextDecoder().decode(bytes));
        svgFrame.name = node.name;
        svgFrame.resize(Math.max(1, node.bounds.width), Math.max(1, node.bounds.height));
        svgFrame.x = node.bounds.x;
        svgFrame.y = node.bounds.y;
        svgFrame.opacity = clamp(node.opacity, 0, 1);
        return svgFrame;
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

function viewportLabel(width: number): string {
  if (width <= 480) return "Mobile";
  if (width <= 1024) return "Tablet";
  return "Desktop";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
