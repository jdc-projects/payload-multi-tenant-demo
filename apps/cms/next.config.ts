import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  assetPrefix: process.env.CMS_ASSET_PREFIX ?? "/cms",
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  serverExternalPackages: [
    "payload",
    "@payloadcms/db-postgres",
    "@payloadcms/drizzle",
  ],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      ".js": [".js", ".ts"],
      ".jsx": [".jsx", ".tsx"],
    };
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      "@payload-config": path.resolve(process.cwd(), "src/payload.config.ts"),
    };
    return webpackConfig;
  },
};

export default config;
