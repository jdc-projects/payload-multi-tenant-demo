import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export default function globalTeardown() {
  const project = process.env.TEST_COMPOSE_PROJECT;
  if (!project) return;
  execFileSync(
    "docker",
    ["compose", "-p", project, "-f", "infra/docker-compose.yml", "down"],
    { env: process.env, stdio: "inherit" },
  );
  for (const app of ["apps/cms", "apps/web"]) {
    const file = path.resolve(app, "next-env.d.ts");
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    fs.writeFileSync(
      file,
      source.replace(/\.\/\.next-payload-demo-[^/]+/g, "./.next"),
    );
  }
}
