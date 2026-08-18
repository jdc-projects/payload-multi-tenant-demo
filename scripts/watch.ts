import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { loadRootEnv } from "./env.js";

loadRootEnv();

const root = process.cwd();
const ports = {
  cms: process.env.CMS_PORT ?? "3001",
  web: process.env.WEB_PORT ?? "3000",
  proxy: process.env.PROXY_PORT ?? "8888",
};
const environment = {
  ...process.env,
  POSTGRES_PORT: process.env.POSTGRES_PORT ?? "5432",
  S3_PORT: process.env.S3_PORT ?? "9000",
  S3_CONSOLE_PORT: process.env.S3_CONSOLE_PORT ?? "9001",
  CMS_PORT: ports.cms,
  WEB_PORT: ports.web,
  PROXY_PORT: ports.proxy,
  WEB_UPSTREAM: `host.docker.internal:${ports.web}`,
  CMS_UPSTREAM: `host.docker.internal:${ports.cms}`,
};
const children: ChildProcess[] = [];
let cleaning = false;

function run(command: string, args: string[], cwd = root) {
  const child = spawn(command, args, {
    cwd,
    env: environment,
    stdio: "inherit",
  });
  children.push(child);
  return child;
}

function waitForExit(child: ChildProcess) {
  return new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function waitFor(url: string, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Host applications can take a few seconds to compile on first start.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function killTree(pid: number) {
  try {
    for (const child of childPids(pid)) killTree(child);
  } catch {
    // The process may already have exited.
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // The process may already have exited.
  }
}

function childPids(pid: number) {
  const output = execFileSync("pgrep", ["-P", String(pid)], {
    encoding: "utf8",
  }) as string;
  return output.trim().split("\n").filter(Boolean).map(Number);
}

function cleanup() {
  if (cleaning) return;
  cleaning = true;
  for (const child of children) if (child.pid) killTree(child.pid);
  // Deliberately omit --volumes: local watch owns containers, not developer data.
  try {
    execFileSync(
      "docker",
      ["compose", "-f", "infra/docker-compose.yml", "down", "--remove-orphans"],
      { cwd: root, env: environment, stdio: "inherit" },
    );
  } catch {
    // Preserve the application failure if Docker has already stopped.
  }
}

async function main() {
  const infrastructure = run("docker", [
    "compose",
    "-f",
    "infra/docker-compose.yml",
    "up",
    "-d",
    "--wait",
  ]);
  if ((await waitForExit(infrastructure)) !== 0)
    throw new Error("Development infrastructure failed to start");

  const cms = run(
    process.execPath,
    ["--import", "tsx", `${root}/scripts/run-next.ts`, "cms", "dev"],
    `${root}/apps/cms`,
  );
  const web = run(
    process.execPath,
    ["--import", "tsx", `${root}/scripts/run-next.ts`, "web", "dev"],
    `${root}/apps/web`,
  );
  for (const [child, name] of [
    [cms, "CMS"],
    [web, "web"],
  ] as const)
    child.once("exit", (code) => {
      if (!cleaning && code !== 0) {
        console.error(`${name} watch process exited (${code ?? "signal"})`);
        cleanup();
        process.exit(1);
      }
    });

  await waitFor(`http://127.0.0.1:${ports.cms}/admin`);
  await waitFor(`http://127.0.0.1:${ports.web}/`);
  await waitFor(`http://127.0.0.1:${ports.proxy}/`);
  console.log(`Watch mode ready: http://127.0.0.1:${ports.proxy}/`);
  await new Promise(() => undefined);
}

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    cleanup();
    process.exitCode = signal === "SIGINT" ? 130 : 143;
  });
process.once("exit", cleanup);
void main().catch((error) => {
  console.error(error);
  cleanup();
  process.exitCode = 1;
});
