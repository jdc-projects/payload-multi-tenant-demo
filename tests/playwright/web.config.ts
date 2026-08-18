import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env");
} catch {
  // Environment variables may be supplied by the caller or CI.
}

process.env.TEST_COMPOSE_PROJECT ??= `payload-demo-web-${process.pid}`;
const proxyPort =
  process.env.TEST_PROXY_PORT ?? String(10000 + (process.pid % 10000));
process.env.TEST_PROXY_PORT = proxyPort;

export default defineConfig({
  testDir: "./web",
  globalTeardown: "./global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "dot" : "list",
  use: { baseURL: `http://127.0.0.1:${proxyPort}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "cd ../.. && exec npx tsx scripts/test-stack.ts web",
    url: `http://127.0.0.1:${proxyPort}`,
    reuseExistingServer: false,
    timeout: 180000,
  },
});
