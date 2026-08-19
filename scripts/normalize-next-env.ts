import fs from "node:fs";

const app = process.argv[2];
if (app !== "cms" && app !== "web") throw new Error("Expected cms or web");

const file = `${process.cwd()}/next-env.d.ts`;
if (fs.existsSync(file)) {
  const source = fs.readFileSync(file, "utf8");
  const normalized = source
    .replace(/\.\/\.next\/dev\/types\//g, "./.next/types/")
    .replace(/\.\/\.next-payload-demo-[^/]+/g, "./.next");
  if (normalized !== source) fs.writeFileSync(file, normalized);
}
