import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, "figma-plugin");
const outputDir = path.join(pluginDir, "dist");
const vendorDir = path.join(outputDir, "vendor");

fs.mkdirSync(vendorDir, { recursive: true });
const uiHtml = fs.readFileSync(path.join(pluginDir, "index.html"), "utf8");
const jszipPath = path.join(root, "node_modules", "jszip", "dist", "jszip.min.js");
const jszipSource = fs.readFileSync(jszipPath, "utf8");
const uiWithBundledZip = uiHtml.replace(
  '<script src="./vendor/jszip.min.js"></script>',
  `<script>${jszipSource}</script>`
);
if (uiWithBundledZip === uiHtml) {
  throw new Error("Could not find the JSZip script placeholder in figma-plugin/index.html.");
}
fs.writeFileSync(path.join(outputDir, "index.html"), uiWithBundledZip);
// Keep a standalone copy for debugging and packaging tools that expect vendor/.
fs.copyFileSync(jszipPath, path.join(vendorDir, "jszip.min.js"));
// The type-only schema import makes tsc emit `export {};`, but Figma runs
// plugin code as a classic script and rejects module syntax.
const pluginCode = fs
  .readFileSync(path.join(outputDir, "figma-plugin", "code.js"), "utf8")
  .replace(/^\s*export\s*\{\s*\};?\s*$/gm, "");
if (/^\s*(import|export)\b/m.test(pluginCode)) {
  throw new Error("figma-plugin/dist/code.js still contains module syntax; Figma plugins must be a single classic script.");
}
fs.writeFileSync(path.join(outputDir, "code.js"), pluginCode);
console.log("Prepared the shared-schema Figma plugin in figma-plugin/dist.");
