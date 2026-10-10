# Web to Figma Importer

The companion plugin reads `design.json` and packaged assets from a capture ZIP, then creates an editable page frame in the current Figma document.

## Build and load locally

1. From the repository root, run `npm install` and `npm run build:figma-plugin`.
2. In Figma, choose **Plugins → Development → Import plugin from manifest…**.
3. Select this folder's `manifest.json`.
4. Run **Web to Figma Importer** from **Plugins → Development**.
5. In the plugin, choose a ZIP downloaded from **Download Capture Package** or **Download Website Package**, then choose **Import design**.

The build writes the generated plugin code and bundled ZIP reader to the ignored `figma-plugin/dist/` folder. Rebuild after changing `code.ts` or `index.html`.

## Current support

- Creates named native frames and editable text nodes.
- Maps basic fills, strokes, opacity, corner radius, and supported flex layouts to Figma Auto Layout.
- Places packaged PNG/JPEG/GIF assets as image fills and SVGs as vector frames.
- Preserves absolute positions where Auto Layout is not inferred.
- Reports grid, CSS background image, and missing asset limitations in the design package.
- Imports multi-page website packages as multiple frames in the current Figma page.

The importer does not make a `.fig` file on the web server. It creates nodes in the open Figma document, where Figma manages saving and export.
