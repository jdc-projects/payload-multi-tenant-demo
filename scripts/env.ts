import path from "node:path";
import fs from "node:fs";

export function loadRootEnv() {
  for (const candidate of [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ]) {
    if (!fs.existsSync(candidate)) continue;
    try {
      process.loadEnvFile(candidate);
    } catch {
      // Environment variables may be supplied by the caller or CI.
    }
    return;
  }
}
