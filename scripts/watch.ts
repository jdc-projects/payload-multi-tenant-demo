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
const ownerIdentity = `payload-demo-watch:${composeProject}:${ownerToken}`;
const manifestFile = `${root}/.watch-${composeProject}.json`;
const claimDirectory = "/tmp/payload-demo-watch-port-claims";
const staleAge = 10 * 60_000;
let environment: NodeJS.ProcessEnv;
const children: ChildProcess[] = [];
let cleaning = false;
let stopping = false;
let stopStatus = 1;
let claimedPorts: string[] = [];
let inProgressClaims: string[] = [];
let stopWatch: (status: number) => void = () => undefined;
const readinessAbort = new AbortController();
const defaultPorts = {
  proxy: 23_000,
  postgres: 20_000,
  s3: 21_000,
  s3Console: 22_000,
  cms: 24_000,
  web: 25_000,
};

function startupCheckpoint() {
  if (stopping) throw new Error("Watch stopped");
}

function portIsAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

function allPortsConfigured() {
  return Object.values(explicitPorts).every(Boolean);
}

function candidatePorts(offset: number) {
  return Object.fromEntries(
    Object.entries(defaultPorts).map(([key, base]) => [
      key,
      String(base + offset),
    ]),
  ) as Ports;
}

function automaticPorts(candidate: Ports) {
  return Object.entries(explicitPorts)
    .filter(([, value]) => !value)
    .map(([key]) => candidate[key as keyof Ports]);
}

function claimOwnerStatus(file: string) {
  try {
    const owner = JSON.parse(fs.readFileSync(`${file}/owner`, "utf8")) as {
      pid?: number;
      token?: string;
      identity?: string;
    };
    if (!owner.pid || !owner.token || !owner.identity)
      return "unknown" as const;
    process.kill(owner.pid, 0);
    const command = execFileSync(
      "ps",
      ["-p", String(owner.pid), "-o", "command="],
      {
        encoding: "utf8",
      },
    );
    return command.includes(owner.identity) && command.includes(owner.token)
      ? ("alive" as const)
      : ("stale" as const);
  } catch {
    return "stale" as const;
  }
}

function claimPort(port: string) {
  const file = `${claimDirectory}/${port}`;
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
  fs.mkdirSync(temporary);
  const temporaryOwner = `${temporary}/owner.tmp`;
  fs.writeFileSync(
    temporaryOwner,
    JSON.stringify({
      pid: process.pid,
      token: ownerToken,
      identity: ownerIdentity,
      at: Date.now(),
    }),
    { flag: "wx" },
  );
  fs.renameSync(temporaryOwner, `${temporary}/owner`);
  try {
    // Publishing a complete directory is atomic. A killed process can only
    // leave a uniquely named temporary directory, which allocation reclaims.
    fs.renameSync(temporary, file);
  } catch (error) {
    const status = claimOwnerStatus(file);
    if (status === "alive" || status === "unknown") {
      fs.rmSync(temporary, { recursive: true, force: true });
      throw error;
    }
    // A dead owner or a PID whose process identity no longer matches is
    // reclaimable. Checking identity prevents PID reuse preserving a stale
    // claim.
    fs.rmSync(file, { recursive: true, force: true });
    fs.renameSync(temporary, file);
  }
  fs.rmSync(temporary, { recursive: true, force: true });
  inProgressClaims.push(file);
  return file;
}

function reclaimInterruptedClaims() {
  if (!fs.existsSync(claimDirectory)) return;
  for (const entry of fs.readdirSync(claimDirectory)) {
    if (!entry.includes(".tmp-")) continue;
    const file = `${claimDirectory}/${entry}`;
    try {
      const stat = fs.statSync(file);
      if (Date.now() - stat.mtimeMs > 1_000)
        fs.rmSync(file, { recursive: true, force: true });
    } catch {
      // Another allocator may be publishing or reclaiming this claim.
    }
  }
}

async function portsAvailable(portsToCheck: string[]) {
  const available = await Promise.all(
    portsToCheck.map((port) => portIsAvailable(Number(port))),
  );
  return available.every(Boolean);
}

function releaseClaims(claims: string[]) {
  for (const file of claims) {
    try {
      const owner = JSON.parse(fs.readFileSync(`${file}/owner`, "utf8")) as {
        pid?: number;
        token?: string;
        identity?: string;
      };
      if (
        owner.pid !== process.pid ||
        owner.token !== ownerToken ||
        owner.identity !== ownerIdentity
      )
        continue;
      fs.rmSync(file, { recursive: true, force: true });
    } catch {
      // The claim may already have been reclaimed by another allocator.
    }
  }
}

async function allocatePorts() {
  if (allPortsConfigured()) return explicitPorts as Ports;
  fs.mkdirSync(claimDirectory, { recursive: true });
  reclaimInterruptedClaims();
  const start = process.pid % 10_000;
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const offset = (start + attempt) % 10_000;
    const candidate = candidatePorts(offset);
    const automatic = automaticPorts(candidate);
    const claims: string[] = [];
    try {
      for (const port of automatic) claims.push(claimPort(port));
      if (await portsAvailable(automatic)) {
        if (stopping) {
          releaseClaims(claims);
          throw new Error("Watch stopped");
        }
        claimedPorts = claims;
        inProgressClaims = inProgressClaims.filter(
          (file) => !claims.includes(file),
        );
        return { ...candidate, ...explicitPorts } as Ports;
      }
    } catch (error) {
      if (stopping) throw error;
      // Another watch process claimed this candidate.
    }
    releaseClaims(claims);
    inProgressClaims = inProgressClaims.filter(
      (file) => !claims.includes(file),
    );
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

type WatchManifest = {
  pid?: number;
  token?: string;
  startedAt?: number;
  project?: string;
};

function watchProjects() {
  try {
    return JSON.parse(
      execFileSync("docker", ["compose", "ls", "--all", "--format", "json"], {
        cwd: root,
        encoding: "utf8",
      }),
    ) as Array<{ Name?: string }>;
  } catch {
    return [];
  }
}

function isWatchProject(name: string | undefined) {
  return Boolean(
    name && /^payload-demo-watch-\d+$/.test(name) && name !== composeProject,
  );
}

function readManifest(file: string) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as WatchManifest;
  } catch {
    return undefined;
  }
}

function isOwnedWatch(name: string, manifest: WatchManifest) {
  if (!manifest.project || !manifest.pid || !manifest.token) return false;
  try {
    return execFileSync("ps", ["-p", String(manifest.pid), "-o", "command="], {
      encoding: "utf8",
    }).includes(`payload-demo-watch:${name}:${manifest.token}`);
  } catch {
    return false;
  }
}

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function removeStaleProject(
  name: string,
  file: string,
  manifest: WatchManifest,
) {
  if (isOwnedWatch(name, manifest)) return;
  const pid = manifest.pid ?? Number(name.slice("payload-demo-watch-".length));
  // A dead owner is stale immediately. The age fallback handles manifests
  // from older versions which did not record a usable pid.
  if (pid && processIsAlive(pid)) return;
  if (
    !pid &&
    (!manifest.startedAt || Date.now() - manifest.startedAt < staleAge)
  )
    return;
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
}

function reconcileStaleProject(name: string) {
  const file = `${root}/.watch-${name}.json`;
  const manifest = readManifest(file);
  try {
    // Missing or malformed manifests are recoverable when the PID encoded in
    // this repository-owned project name is no longer running.
    removeStaleProject(name, file, manifest ?? {});
  } catch {
    // Never let one broken project prevent startup or broaden cleanup scope.
  }
}

function reconcileStaleProjects() {
  for (const project of watchProjects()) {
    if (isWatchProject(project.Name)) reconcileStaleProject(project.Name!);
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
  releaseClaims([...claimedPorts, ...inProgressClaims]);
  claimedPorts = [];
  inProgressClaims = [];
  fs.rmSync(manifestFile, { force: true });
}

async function main() {
  // Claims are created before infrastructure starts, so publish the process
  // identity before allocation as well as in the manifest.
  process.title = ownerIdentity;
  ports = await allocatePorts();
  startupCheckpoint();
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
  fs.writeFileSync(
    manifestFile,
    JSON.stringify({
      pid: process.pid,
      project: composeProject,
      token: ownerToken,
      startedAt: Date.now(),
    }),
  );
  startupCheckpoint();
  reconcileStaleProjects();
  startupCheckpoint();
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
  const infrastructureStatus = await waitForExit(infrastructure);
  startupCheckpoint();
  if (infrastructureStatus !== 0)
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
  let startupReady = false;
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
        const status = exitStatus(code, signal);
        resolve(startupReady ? status : status || 1);
      });
  });

  async function waitForReady(url: string) {
    const result = await Promise.race([
      waitFor(url)
        .then(() => null)
        .catch(() => ({ status: stopping ? stopStatus : 1 })),
      watchExit.then((status) => ({ status })),
    ]);
    if (result !== null) {
      process.exitCode = result.status;
      stopWatch(result.status);
      cleanup();
      // Readiness failure must not leave the host processes (or their event
      // loop handles) keeping watch.ts alive after its scoped Compose cleanup.
      if (result.status === 0) result.status = 1;
      process.exit(result.status);
      return false;
    }
    return true;
  }

  if (!(await waitForReady(`http://127.0.0.1:${ports.cms}/admin`))) return;
  if (!(await waitForReady(`http://127.0.0.1:${ports.web}/`))) return;
  if (!(await waitForReady(`http://127.0.0.1:${ports.proxy}/`))) return;
  startupReady = true;
  console.log(`Watch mode ready: http://127.0.0.1:${ports.proxy}/`);
  process.exitCode = await watchExit;
}

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    stopping = true;
    stopStatus = signal === "SIGINT" ? 130 : 143;
    readinessAbort.abort();
    stopWatch(stopStatus);
    cleanup();
    process.exitCode = stopStatus;
  });
process.once("exit", cleanup);
void main().catch((error) => {
  if (!stopping) console.error(error);
  cleanup();
  process.exitCode = stopping ? stopStatus : 1;
});
