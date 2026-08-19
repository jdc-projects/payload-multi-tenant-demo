import { spawn } from "node:child_process";
import { loadRootEnv } from "./env.js";

loadRootEnv();

const command = process.argv[2] ?? "up";
const project = process.env.TEST_COMPOSE_PROJECT;
const args = ["compose"];
if (project) args.push("-p", project);
args.push("-f", "infra/docker-compose.yml", command);
if (command === "up") args.push("-d", "--wait");

const env = {
  ...process.env,
  POSTGRES_PORT: process.env.POSTGRES_PORT ?? "5432",
  S3_PORT: process.env.S3_PORT ?? "9000",
  S3_CONSOLE_PORT: process.env.S3_CONSOLE_PORT ?? "9001",
  PROXY_PORT: process.env.PROXY_PORT ?? "8888",
  WEB_UPSTREAM: `host.docker.internal:${process.env.WEB_PORT ?? "3000"}`,
  CMS_UPSTREAM: `host.docker.internal:${process.env.CMS_PORT ?? "3001"}`,
};
const child = spawn("docker", args, { stdio: "inherit", env });
child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code) => process.exit(code ?? 1));
