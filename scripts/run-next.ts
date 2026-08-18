import { spawn } from "node:child_process";
import { loadRootEnv } from "./env.js";

loadRootEnv();

const app = process.argv[2];
const command = process.argv[3] ?? "dev";
const isCMS = app === "cms";
if (!isCMS && app !== "web") throw new Error("Expected cms or web");

const port = Number(
  process.env[isCMS ? "CMS_PORT" : "WEB_PORT"] ?? (isCMS ? 3001 : 3000),
);
const args = [command, "-p", String(port)];
if (isCMS && command === "dev") args.splice(1, 0, "--webpack");

const child = spawn("next", args, { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => child.kill(signal));
child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
