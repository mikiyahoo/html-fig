/** @type {import('next').NextConfig} */
import path from "node:path";

const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    return config;
  },
};

export default nextConfig;
