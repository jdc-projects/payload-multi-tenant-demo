import { execFileSync } from "node:child_process";

export default function globalTeardown() {
  execFileSync(
    "docker",
    ["compose", "-f", "infra/docker-compose.yml", "down"],
    {
      stdio: "inherit",
    },
  );
}
