# Web to Figma Importer

The companion plugin reads the shared, versioned design-tree schema and packaged assets, then creates editable native nodes in the current Figma Design document. It accepts a short-lived transfer link from the web app or a capture ZIP.

## Build and load locally

1. From the repository root, run `npm install` and `npm run build:figma-plugin`.
2. In Figma, choose **Plugins → Development → Import plugin from manifest…**.
3. Select this folder's `manifest.json`.
4. Open or create a Figma Design document and run **Web to Figma Importer** from **Plugins → Development**.
5. For a direct handoff, choose **Open in Figma** in the web app, copy the short-lived transfer link into the plugin, and choose **Create Editable Design**. The link expires after 30 minutes.
6. To import later, choose **Import a ZIP instead**, select a package downloaded from **Download Capture Package** or **Download Website Package**, then choose **Import ZIP**.
7. After native layers are created, use **File → Save local copy** in Figma to download a genuine `.fig` document. The web app and plugin do not manufacture `.fig` files.

The build writes the generated plugin code and bundled ZIP reader to the ignored `figma-plugin/dist/` folder. Rebuild after changing `code.ts` or `index.html`.

## Current support

- Creates named native frames, editable text nodes, rectangles, ellipses, and supported Auto Layout structures.
- Maps basic fills, strokes, opacity, corner radius, typography, and alignment.
- Places packaged PNG/JPEG/GIF assets as image fills and SVGs as vector frames.
- Preserves absolute positions where Auto Layout is not inferred.
- Reports grid, CSS backgrounds, unsupported effects, missing or unsupported assets, and unavailable fonts. Fonts fall back to Inter Regular and image failures use visible placeholders where possible.
- Imports multi-page website packages as multiple frames in the current Figma page.

The web app and plugin consume the same schema in `shared/design-schema.ts`. Bump its version when making an incompatible design-tree change and update both consumers together. Figma's documented plugin export API provides image, SVG, PDF, video, and REST JSON representations, but not a native `.fig` file; saving the editable document is handled by Figma's **File → Save local copy** command.
