import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function stopManagedStack(project: string) {
  const manifestFile = path.resolve(`.test-stack-${project}.json`);
  if (!fs.existsSync(manifestFile)) return;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
      pid?: number;
    };
    if (!manifest.pid) return;
    const command = execFileSync(
      "ps",
      ["-p", String(manifest.pid), "-o", "command="],
      {
        encoding: "utf8",
      },
    );
    if (!command.includes("scripts/test-stack.ts")) return;
    process.kill(manifest.pid, "SIGTERM");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        process.kill(manifest.pid, 0);
      } catch {
        return;
      }
      execFileSync("sleep", ["0.1"]);
    }
  } catch {
    // The managed process may already have exited during Playwright cleanup.
  }
}

export default function globalTeardown() {
  const project = process.env.TEST_COMPOSE_PROJECT;
  if (!project) return;
  stopManagedStack(project);
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
