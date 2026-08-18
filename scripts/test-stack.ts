import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";

const mode = process.argv[2];
const port = mode === "web" ? 3100 : 3000;
const proxyPort = 8888;
const root = process.cwd();
const children: ChildProcess[] = [];
let cleaned = false;
const testEnv = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgres://payload:payload@127.0.0.1:5432/payload",
  NEXT_PUBLIC_CMS_URL:
    process.env.NEXT_PUBLIC_CMS_URL ?? "http://127.0.0.1:3001",
  PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? "test-only-secret",
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
  S3_BUCKET: process.env.S3_BUCKET ?? "payload-media",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "payload",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "payload-secret",
};

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
  for (const child of children) child.kill("SIGTERM");
  try {
    execFileSync(
      "docker",
      ["compose", "-f", "infra/docker-compose.yml", "down"],
      { cwd: root, stdio: "inherit" },
    );
  } catch {
    // Preserve the original test result if Docker has already stopped.
  }
}

async function main() {
  if (!mode || !["build", "web", "e2e", "artillery"].includes(mode))
    throw new Error("Usage: test-stack.ts <build|web|e2e|artillery>");
  const infrastructure = run(
    "docker",
    ["compose", "-f", "infra/docker-compose.yml", "up", "-d", "--wait"],
    { env: { ...testEnv, WEB_UPSTREAM: `host.docker.internal:${port}` } },
  );
  const [infrastructureCode] = (await once(infrastructure, "exit")) as [
    number | null,
  ];
  if (infrastructureCode !== 0)
    throw new Error("Test infrastructure failed to start");
  const cms = run("npx", ["tsx", "apps/cms/src/test-server.ts"], {
    env: { ...testEnv, PORT: "3001" },
  });
  await waitFor("http://127.0.0.1:3001/health");
  execFileSync("npm", ["run", "seed:cms"], {
    cwd: root,
    env: testEnv,
    stdio: "inherit",
  });
  if (mode === "build") {
    execFileSync("npm", ["run", "build", "--workspace", "@demo/cms"], {
      cwd: root,
      env: testEnv,
      stdio: "inherit",
    });
  }
  execFileSync("npm", ["run", "build", "--workspace", "@demo/web"], {
    cwd: root,
    env: testEnv,
    stdio: "inherit",
  });
  if (mode === "build") {
    cleanup();
    process.exit(0);
  }
  cms.kill("SIGTERM");

  const web = run("npx", [
    "serve",
    "apps/web/out",
    "-l",
    String(port),
    "--no-clipboard",
  ]);
  await waitFor(`http://127.0.0.1:${proxyPort}/`);
  if (mode === "artillery") {
    const artillery = run("npx", [
      "artillery",
      "run",
      "--target",
      `http://127.0.0.1:${proxyPort}`,
      "tests/artillery/smoke.yml",
    ]);
    const [result] = await once(artillery, "exit");
    web.kill("SIGTERM");
    cleanup();
    process.exit(typeof result === "number" ? result : 1);
  } else {
    await once(web, "exit");
  }
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
  process.exitCode = 1;
});
