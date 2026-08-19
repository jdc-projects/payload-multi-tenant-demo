import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { loadRootEnv } from "./env.js";

loadRootEnv();

const root = process.cwd();
const portOffset = process.pid % 10_000;
const configuredPort = (name: string, testName: string, fallback: number) =>
  process.env[name] ?? process.env[testName] ?? String(fallback + portOffset);
const ports = {
  cms: configuredPort("CMS_PORT", "TEST_CMS_PORT", 24_000),
  web: configuredPort("WEB_PORT", "TEST_WEB_PORT", 25_000),
  proxy: configuredPort("PROXY_PORT", "TEST_PROXY_PORT", 23_000),
  postgres: configuredPort("POSTGRES_PORT", "TEST_POSTGRES_PORT", 20_000),
  s3: configuredPort("S3_PORT", "TEST_S3_PORT", 21_000),
  s3Console: configuredPort("S3_CONSOLE_PORT", "TEST_S3_CONSOLE_PORT", 22_000),
};
const composeProject = `payload-demo-watch-${process.pid}`;
const environment = {
  ...process.env,
  POSTGRES_PORT: ports.postgres,
  S3_PORT: ports.s3,
  S3_CONSOLE_PORT: ports.s3Console,
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

function exitStatus(code: number | null, signal: NodeJS.Signals | null) {
  if (code !== null) return code;
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 1;
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
      [
        "compose",
        "-p",
        composeProject,
        "-f",
        "infra/docker-compose.yml",
        "down",
        "--remove-orphans",
      ],
      { cwd: root, env: environment, stdio: "inherit" },
    );
  } catch {
    // Preserve the application failure if Docker has already stopped.
  }
}

async function main() {
  const infrastructure = run("docker", [
    "compose",
    "-p",
    composeProject,
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
  const watchExit = new Promise<number>((resolve) => {
    for (const [child, name] of [
      [cms, "CMS"],
      [web, "web"],
    ] as const)
      child.once("exit", (code, signal) => {
        if (cleaning) return;
        console.error(
          `${name} watch process exited (${code ?? signal ?? "unknown"})`,
        );
        cleanup();
        resolve(exitStatus(code, signal));
      });
  });

  async function waitForReady(url: string) {
    const result = await Promise.race([
      waitFor(url).then(() => null),
      watchExit.then((status) => ({ status })),
    ]);
    if (result !== null) {
      process.exitCode = result.status;
      return false;
    }
    return true;
  }

  if (!(await waitForReady(`http://127.0.0.1:${ports.cms}/admin`))) return;
  if (!(await waitForReady(`http://127.0.0.1:${ports.web}/`))) return;
  if (!(await waitForReady(`http://127.0.0.1:${ports.proxy}/`))) return;
  console.log(`Watch mode ready: http://127.0.0.1:${ports.proxy}/`);
  process.exitCode = await watchExit;
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
