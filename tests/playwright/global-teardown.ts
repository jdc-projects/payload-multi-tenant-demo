import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const managedProjectPattern = /^payload-demo-[A-Za-z0-9_-]+$/;

function ownedStack(project: string) {
  if (!managedProjectPattern.test(project)) return null;
  const manifestFile = path.resolve(`.test-stack-${project}.json`);
  if (!fs.existsSync(manifestFile)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
      pid?: number;
      project?: string;
    };
    if (manifest.project !== project || !manifest.pid) return null;
    let command = "";
    try {
      command = execFileSync(
        "ps",
        ["-p", String(manifest.pid), "-o", "command="],
        { encoding: "utf8" },
      );
    } catch {
      // The owner process may already have exited.
    }
    if (command && !command.includes("scripts/test-stack.ts")) return null;
    return { command, manifestFile, pid: manifest.pid };
  } catch {
    return null;
  }
}

function stopManagedStack(project: string) {
  const stack = ownedStack(project);
  if (!stack) return false;
  if (stack.command.includes("scripts/test-stack.ts")) {
    try {
      process.kill(stack.pid, "SIGTERM");
    } catch {
      // The owner may have exited after the process check.
    }
    for (let attempt = 0; attempt < 600; attempt += 1) {
      if (!fs.existsSync(stack.manifestFile)) return true;
      execFileSync("sleep", ["0.1"]);
    }
    throw new Error(`Timed out stopping managed test stack ${project}`);
  }
  return true;
}

export default function globalTeardown() {
  const project = process.env.TEST_COMPOSE_PROJECT;
  if (!project || !stopManagedStack(project)) return;
  execFileSync(
    "docker",
    [
      "compose",
      "-p",
      project,
      "-f",
      "infra/docker-compose.yml",
      "down",
      "--volumes",
    ],
    { env: process.env, stdio: "inherit" },
  );
  for (const app of ["apps/cms", "apps/web"]) {
    const file = path.resolve(app, "next-env.d.ts");
    if (fs.existsSync(file)) {
      const source = fs.readFileSync(file, "utf8");
      fs.writeFileSync(
        file,
        source.replace(/\.\/\.next-payload-demo-[^/]+/g, "./.next"),
      );
    }
    fs.rmSync(path.resolve(app, `.next-${project}`), {
      recursive: true,
      force: true,
    });
  }
}
