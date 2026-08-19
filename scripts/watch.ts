import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { loadRootEnv } from "./env.js";

loadRootEnv();

const root = process.cwd();
const configuredPort = (name: string, testName: string) =>
  process.env[name] ?? process.env[testName];
const explicitPorts = {
  cms: configuredPort("CMS_PORT", "TEST_CMS_PORT"),
  web: configuredPort("WEB_PORT", "TEST_WEB_PORT"),
  proxy: configuredPort("PROXY_PORT", "TEST_PROXY_PORT"),
  postgres: configuredPort("POSTGRES_PORT", "TEST_POSTGRES_PORT"),
  s3: configuredPort("S3_PORT", "TEST_S3_PORT"),
  s3Console: configuredPort("S3_CONSOLE_PORT", "TEST_S3_CONSOLE_PORT"),
};
type Ports = typeof explicitPorts & Record<never, never>;
let ports: Ports;
const composeProject = `payload-demo-watch-${process.pid}`;
const ownerToken = randomUUID();
const manifestFile = `${root}/.watch-${composeProject}.json`;
const claimDirectory = "/tmp/payload-demo-watch-port-claims";
const staleAge = 10 * 60_000;
let environment: NodeJS.ProcessEnv;
const children: ChildProcess[] = [];
let cleaning = false;
let claimedPorts: string[] = [];
let stopWatch: (status: number) => void = () => undefined;
const readinessAbort = new AbortController();

function portIsAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function allocatePorts() {
  const defaults = {
    proxy: 23_000,
    postgres: 20_000,
    s3: 21_000,
    s3Console: 22_000,
    cms: 24_000,
    web: 25_000,
  };
  const values = Object.values(explicitPorts);
  if (values.every(Boolean)) return explicitPorts as Ports;
  fs.mkdirSync(claimDirectory, { recursive: true });
  const start = process.pid % 10_000;
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const offset = (start + attempt) % 10_000;
    const candidate = Object.fromEntries(
      Object.entries(defaults).map(([key, base]) => [
        key,
        String(base + offset),
      ]),
    ) as Ports;
    const automatic = Object.entries(explicitPorts)
      .filter(([, value]) => !value)
      .map(([key]) => candidate[key as keyof Ports]);
    const claims: string[] = [];
    try {
      for (const port of automatic) {
        const file = `${claimDirectory}/${port}`;
        let fd: number | undefined;
        try {
          fd = fs.openSync(file, "wx");
        } catch (error) {
          try {
            const owner = JSON.parse(fs.readFileSync(file, "utf8")) as {
              pid?: number;
            };
            if (owner.pid) process.kill(owner.pid, 0);
          } catch {
            fs.rmSync(file, { force: true });
            fd = fs.openSync(file, "wx");
          }
          if (fd === undefined) throw error;
        }
        if (fd === undefined) throw new Error("Port claim failed");
        fs.writeFileSync(
          fd,
          JSON.stringify({ pid: process.pid, at: Date.now() }),
        );
        fs.closeSync(fd);
        claims.push(file);
      }
      if (
        (
          await Promise.all(
            automatic.map((port) => portIsAvailable(Number(port))),
          )
        ).every(Boolean)
      ) {
        claimedPorts = claims;
        return { ...candidate, ...explicitPorts } as Ports;
      }
    } catch {
      // Another watch process claimed this candidate.
    }
    for (const file of claims) fs.rmSync(file, { force: true });
  }
  throw new Error("Unable to allocate isolated watch ports");
}

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
    if (readinessAbort.signal.aborted) throw new Error("Watch stopped");
    try {
      if ((await fetch(url, { signal: readinessAbort.signal })).ok) return;
    } catch {
      // Host applications can take a few seconds to compile on first start.
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 500);
      readinessAbort.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function reconcileStaleProjects() {
  let projects: Array<{ Name?: string }> = [];
  try {
    projects = JSON.parse(
      execFileSync("docker", ["compose", "ls", "--all", "--format", "json"], {
        cwd: root,
        encoding: "utf8",
      }),
    ) as Array<{ Name?: string }>;
  } catch {
    return;
  }
  for (const project of projects) {
    const name = project.Name;
    if (
      !name ||
      !/^payload-demo-watch-\d+$/.test(name) ||
      name === composeProject
    )
      continue;
    const file = `${root}/.watch-${name}.json`;
    try {
      const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as {
        pid?: number;
        token?: string;
        startedAt?: number;
        project?: string;
      };
      const owned =
        manifest.project === name &&
        manifest.pid &&
        manifest.token &&
        execFileSync("ps", ["-p", String(manifest.pid), "-o", "command="], {
          encoding: "utf8",
        }).includes(`payload-demo-watch:${name}:${manifest.token}`);
      if (
        owned ||
        !manifest.startedAt ||
        Date.now() - manifest.startedAt < staleAge
      )
        continue;
      execFileSync(
        "docker",
        [
          "compose",
          "-p",
          name,
          "-f",
          "infra/docker-compose.yml",
          "down",
          "--remove-orphans",
        ],
        { cwd: root, stdio: "inherit" },
      );
      fs.rmSync(file, { force: true });
    } catch {
      // Missing/invalid ownership metadata is never safe to remove.
    }
  }
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
  for (const file of claimedPorts) fs.rmSync(file, { force: true });
  fs.rmSync(manifestFile, { force: true });
}

async function main() {
  ports = await allocatePorts();
  environment = {
    ...process.env,
    POSTGRES_PORT: ports.postgres!,
    S3_PORT: ports.s3!,
    S3_CONSOLE_PORT: ports.s3Console!,
    CMS_PORT: ports.cms!,
    WEB_PORT: ports.web!,
    PROXY_PORT: ports.proxy!,
    WEB_UPSTREAM: `host.docker.internal:${ports.web}`,
    CMS_UPSTREAM: `host.docker.internal:${ports.cms}`,
  };
  process.title = `payload-demo-watch:${composeProject}:${ownerToken}`;
  fs.writeFileSync(
    manifestFile,
    JSON.stringify({
      pid: process.pid,
      project: composeProject,
      token: ownerToken,
      startedAt: Date.now(),
    }),
  );
  reconcileStaleProjects();
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
    stopWatch = resolve;
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
      waitFor(url)
        .then(() => null)
        .catch(() => ({ status: process.exitCode ?? 1 })),
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
    readinessAbort.abort();
    stopWatch(signal === "SIGINT" ? 130 : 143);
    cleanup();
    process.exitCode = signal === "SIGINT" ? 130 : 143;
  });
process.once("exit", cleanup);
void main().catch((error) => {
  console.error(error);
  cleanup();
  process.exitCode = 1;
});
