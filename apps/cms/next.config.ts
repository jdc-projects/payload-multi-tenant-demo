import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
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
