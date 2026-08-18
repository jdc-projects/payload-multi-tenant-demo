import { execFileSync } from "node:child_process";

export default function globalTeardown() {
  const project = process.env.TEST_COMPOSE_PROJECT;
  if (!project) return;
  execFileSync(
    "docker",
    ["compose", "-p", project, "-f", "infra/docker-compose.yml", "down"],
    { env: process.env, stdio: "inherit" },
  );
}
