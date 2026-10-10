/** @type {import('next').NextConfig} */
import path from "node:path";

const nextConfig = {
  reactStrictMode: true,
  // Keep `next dev` artifacts separate from `next build` so a production build
  // cannot replace the styles/chunks served by an already-running dev server.
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium"],
    outputFileTracingIncludes: {
      "/api/captures/**": ["node_modules/@sparticuz/chromium/bin/**/*"],
    },
  },
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    return config;
  },
};

export default nextConfig;
