import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, "figma-plugin");
const outputDir = path.join(pluginDir, "dist");
const vendorDir = path.join(outputDir, "vendor");

fs.mkdirSync(vendorDir, { recursive: true });
fs.copyFileSync(path.join(pluginDir, "index.html"), path.join(outputDir, "index.html"));
fs.copyFileSync(path.join(root, "node_modules", "jszip", "dist", "jszip.min.js"), path.join(vendorDir, "jszip.min.js"));
fs.copyFileSync(path.join(outputDir, "figma-plugin", "code.js"), path.join(outputDir, "code.js"));
console.log("Prepared the shared-schema Figma plugin in figma-plugin/dist.");
