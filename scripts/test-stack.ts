import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { loadRootEnv } from "./env.js";

loadRootEnv();

const mode = process.argv[2];
const webPort = Number(
  process.env.TEST_WEB_PORT ?? 25000 + (process.pid % 10000),
);
const cmsPort = Number(
  process.env.TEST_CMS_PORT ?? 24000 + (process.pid % 10000),
);
const proxyPort = Number(
  process.env.TEST_PROXY_PORT ?? 23000 + (process.pid % 10000),
);
const postgresPort = Number(
  process.env.TEST_POSTGRES_PORT ?? 20000 + (process.pid % 10000),
);
const s3Port = Number(
  process.env.TEST_S3_PORT ?? 21000 + (process.pid % 10000),
);
const s3ConsolePort = Number(
  process.env.TEST_S3_CONSOLE_PORT ?? 22000 + (process.pid % 10000),
);
const root = process.cwd();
const children: ChildProcess[] = [];
let cleaned = false;
let ownsProject = false;
const composeProject =
  process.env.TEST_COMPOSE_PROJECT ?? `payload-demo-${process.pid}`;
const ownerToken = randomUUID();
process.title = `payload-test-stack:${composeProject}:${ownerToken}`;
const manifestFile = `${root}/.test-stack-${composeProject}.json`;
const claimLockFile = `${manifestFile}.lock`;
const managedProjectPattern = /^payload-demo-[A-Za-z0-9_-]+$/;
const reconcilableProjectPattern =
  /^payload-demo-(?:(?:web|e2e|artillery)-)?\d+$/;
const testEnv = {
  ...process.env,
  POSTGRES_HOST: "127.0.0.1",
  POSTGRES_PORT: String(postgresPort),
  S3_HOST: "127.0.0.1",
  S3_PORT: String(s3Port),
  S3_CONSOLE_PORT: String(s3ConsolePort),
  CMS_HOST: "127.0.0.1",
  CMS_PORT: String(cmsPort),
  WEB_HOST: "127.0.0.1",
  WEB_PORT: String(webPort),
  PROXY_HOST: "127.0.0.1",
  PROXY_PORT: String(proxyPort),
  NEXT_DIST_DIR: `.next-${composeProject}`,
  CMS_RENDERER_TOKEN: process.env.CMS_RENDERER_TOKEN ?? "test-renderer-token",
  S3_BUCKET: process.env.S3_BUCKET ?? "payload-media",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "payload",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "payload-secret",
  TEST_COMPOSE_PROJECT: composeProject,
};

function cleanupStaleManagedProjects() {
  let projects: Array<{ Name?: string }> = [];
  try {
    const output = execFileSync(
      "docker",
      ["compose", "ls", "--all", "--format", "json"],
      { cwd: root, encoding: "utf8" },
    );
    projects = JSON.parse(output) as Array<{ Name?: string }>;
  } catch {
    return;
  }

  for (const { Name: name } of projects)
    if (
      name &&
      (reconcilableProjectPattern.test(name) ||
        fs.existsSync(`${root}/.test-stack-${name}.json`)) &&
      name !== composeProject
    )
      reconcileStaleProject(name);
}

function reconcileStaleProject(name: string) {
  const manifest = `${root}/.test-stack-${name}.json`;
  if (isManagedProjectLive(manifest, name)) return;
  try {
    execFileSync(
      "docker",
      [
        "compose",
        "-p",
        name,
        "-f",
        "infra/docker-compose.yml",
        "down",
        "--volumes",
        "--remove-orphans",
      ],
      { cwd: root, stdio: "inherit" },
    );
    removeNextDistDirs(name);
    try {
      fs.unlinkSync(manifest);
    } catch {
      // The manifest may not exist for an older abandoned project.
    }
  } catch {
    // Keep the manifest so a later startup can retry cleanup.
  }
}

function isManagedProjectLive(manifest: string, project: string) {
  if (!fs.existsSync(manifest)) return false;
  try {
    const {
      pid,
      project: manifestProject,
      token,
    } = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
      pid?: number;
      project?: string;
      token?: string;
    };
    if (!pid || !token || manifestProject !== project) return false;
    return isProcessOwnerLive(pid, project, token);
  } catch {
    return false;
  }
}

function isProcessOwnerLive(pid: number, project: string, token: string) {
  return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
  }).includes(`payload-test-stack:${project}:${token}`);
}

function run(
  command: string,
  args: string[],
  options: Parameters<typeof spawn>[2] = {},
) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
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

async function stopChild(child: ChildProcess) {
  const exited = waitForExit(child).catch(() => 1);
  if (child.pid) killProcessTree(child.pid);
  await exited;
}

function killProcessTree(pid: number) {
  let children: string[] = [];
  try {
    children = execFileSync("pgrep", ["-P", String(pid)], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    // The process may already have exited.
  }
  for (const child of children) killProcessTree(Number(child));
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The process may already have exited.
  }
}

async function waitFor(url: string, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (!ownsProject) return;
  for (const child of children) {
    if (!child.pid) continue;
    killProcessTree(child.pid);
  }
  normalizeNextEnvFiles();
  if (mode !== "build") removeNextDistDirs(composeProject);
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
        "--volumes",
      ],
      { cwd: root, env: testEnv, stdio: "inherit" },
    );
  } catch {
    // Preserve the original test result if Docker has already stopped.
  }
  try {
    fs.unlinkSync(manifestFile);
  } catch {
    // The manifest may already have been removed by a fallback teardown.
  }
}

function removeNextDistDirs(project: string) {
  if (!managedProjectPattern.test(project)) return;
  for (const app of ["apps/cms", "apps/web"]) {
    fs.rmSync(`${root}/${app}/.next-${project}`, {
      recursive: true,
      force: true,
    });
  }
}

function normalizeNextEnvFiles() {
  for (const app of ["apps/cms", "apps/web"]) {
    const file = `${root}/${app}/next-env.d.ts`;
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const normalized = source.replace(
      /\.\/\.next-payload-demo-[^/]+/g,
      "./.next",
    );
    if (normalized !== source) fs.writeFileSync(file, normalized);
  }
}

async function main() {
  assertMode();
  claimManagedProject();
  cleanupStaleManagedProjects();
  await startInfrastructure();
  await prepareCms();
  if (mode === "build") return finishBuild();
  await runWebMode();
}

function claimManagedProject() {
  if (!managedProjectPattern.test(composeProject))
    throw new Error("TEST_COMPOSE_PROJECT must start with payload-demo-.");
  acquireClaimLock();
  try {
    if (fs.existsSync(manifestFile)) {
      if (isManagedProjectLive(manifestFile, composeProject))
        throw new Error(
          `Managed test project is already running: ${composeProject}`,
        );
      reconcileStaleProject(composeProject);
      if (fs.existsSync(manifestFile))
        throw new Error(
          `Managed test project cleanup failed: ${composeProject}`,
        );
    }
    writeManifest();
  } finally {
    fs.rmSync(claimLockFile, { recursive: true, force: true });
  }
}

function acquireClaimLock() {
  try {
    fs.mkdirSync(claimLockFile);
    fs.writeFileSync(
      `${claimLockFile}/owner`,
      JSON.stringify({
        pid: process.pid,
        project: composeProject,
        token: ownerToken,
      }),
    );
    return;
  } catch {
    let stale = false;
    try {
      const owner = JSON.parse(
        fs.readFileSync(`${claimLockFile}/owner`, "utf8"),
      ) as { pid?: number; project?: string; token?: string };
      stale =
        !owner.pid ||
        !owner.token ||
        owner.project !== composeProject ||
        !isProcessOwnerLive(owner.pid, owner.project, owner.token);
    } catch {
      const age = Date.now() - fs.statSync(claimLockFile).mtimeMs;
      stale = age > 10_000;
    }
    if (!stale)
      throw new Error(
        `Managed test project is already claimed: ${composeProject}`,
      );
    fs.rmSync(claimLockFile, { recursive: true, force: true });
    acquireClaimLock();
  }
}

function writeManifest() {
  const temporaryManifest = `${manifestFile}.${ownerToken}.tmp`;
  try {
    fs.writeFileSync(
      temporaryManifest,
      JSON.stringify({
        pid: process.pid,
        project: composeProject,
        token: ownerToken,
      }),
    );
    fs.linkSync(temporaryManifest, manifestFile);
    fs.unlinkSync(temporaryManifest);
    ownsProject = true;
  } catch {
    fs.rmSync(temporaryManifest, { force: true });
    throw new Error(
      `Managed test project is already claimed: ${composeProject}`,
    );
  }
}

function assertMode() {
  if (!mode || !["build", "web", "e2e", "artillery"].includes(mode))
    throw new Error("Usage: test-stack.ts <build|web|e2e|artillery>");
}

async function startInfrastructure() {
  const infrastructure = run(
    "docker",
    [
      "compose",
      "-p",
      composeProject,
      "-f",
      "infra/docker-compose.yml",
      "up",
      "-d",
      "--wait",
    ],
    {
      env: {
        ...testEnv,
        WEB_UPSTREAM: `host.docker.internal:${webPort}`,
        CMS_UPSTREAM: `host.docker.internal:${cmsPort}`,
      },
    },
  );
  if ((await waitForExit(infrastructure)) !== 0)
    throw new Error("Test infrastructure failed to start");
}

async function prepareCms() {
  execFileSync("npm", ["run", "build", "--workspace", "@demo/cms"], {
    cwd: root,
    env: testEnv,
    stdio: "inherit",
  });
  const cmsDev = run(
    process.execPath,
    ["--import", "tsx", `${root}/scripts/run-next.ts`, "cms", "dev"],
    {
      cwd: `${root}/apps/cms`,
      env: { ...testEnv, CMS_PORT: String(cmsPort) },
    },
  );
  await waitFor(`http://127.0.0.1:${cmsPort}/admin`);
  execFileSync("npm", ["run", "seed:cms"], {
    cwd: root,
    env: testEnv,
    stdio: "inherit",
  });
  await stopChild(cmsDev);
  const cms = run(
    process.execPath,
    ["--import", "tsx", `${root}/scripts/run-next.ts`, "cms", "start"],
    {
      cwd: `${root}/apps/cms`,
      env: { ...testEnv, CMS_PORT: String(cmsPort) },
    },
  );
  await waitFor(`http://127.0.0.1:${cmsPort}/admin`);
  execFileSync("npm", ["run", "build", "--workspace", "@demo/web"], {
    cwd: root,
    env: testEnv,
    stdio: "inherit",
  });
}

function finishBuild() {
  cleanup();
  process.exit(0);
}

async function runWebMode() {
  const web = run(
    process.execPath,
    ["--import", "tsx", `${root}/scripts/run-next.ts`, "web", "start"],
    {
      cwd: `${root}/apps/web`,
      env: { ...testEnv, WEB_PORT: String(webPort) },
    },
  );
  let webExit: { code: number | null; signal: NodeJS.Signals | null } | null =
    null;
  web.once("exit", (code, signal) => {
    webExit = { code, signal };
  });
  await waitFor(`http://127.0.0.1:${proxyPort}/`);
  if (mode === "artillery") {
    await runArtillery(web, webExit !== null);
    return;
  }
  const result = await waitForExit(web);
  cleanup();
  if (result !== 143 && result !== 130) process.exitCode = result || 1;
}

async function runArtillery(web: ChildProcess, appFailed: boolean) {
  const artillery = run("npx", [
    "artillery",
    "run",
    "--target",
    `http://127.0.0.1:${proxyPort}`,
    "tests/artillery/smoke.yml",
  ]);
  const result = await waitForExit(artillery);
  web.kill("SIGTERM");
  cleanup();
  process.exit(appFailed || result !== 0 ? 1 : 0);
}

process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
process.once("exit", cleanup);
void main().catch((error) => {
  console.error(error);
  cleanup();
  process.exitCode = 1;
});
