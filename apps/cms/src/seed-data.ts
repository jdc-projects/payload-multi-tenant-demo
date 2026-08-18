import fs from "node:fs/promises";
import path from "node:path";

export const FIXTURE_VERSION = 1;
export type SeedFixture = {
  version: 1;
  tenants: Array<{
    name: string;
    slug: string;
    theme?: Record<string, unknown>;
  }>;
  pages: Array<Record<string, unknown> & { tenant: string }>;
  media: Array<Record<string, unknown> & { ref: string }>;
};

/** Remove values Payload generates, including IDs on nested blocks and arrays. */
export function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["id", "createdAt", "updatedAt"].includes(key))
      .map(([key, item]) => [key, normalize(item)]),
  );
}

export function mediaRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mediaRefs);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (typeof record.filename === "string") return { ref: record.filename };
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, mediaRefs(item)]),
  );
}

export function resolveMediaRefs(
  value: unknown,
  mediaIDs: Map<string, string>,
): unknown {
  if (Array.isArray(value))
    return value.map((item) => resolveMediaRefs(item, mediaIDs));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (typeof record.ref === "string")
    return mediaIDs.get(record.ref) ?? record.ref;
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      resolveMediaRefs(item, mediaIDs),
    ]),
  );
}

export function fixturePath(file = "fixtures/v1.json") {
  const cmsRoot =
    path.basename(process.cwd()) === "cms"
      ? process.cwd()
      : path.resolve(process.cwd(), "apps/cms");
  return path.resolve(cmsRoot, "src", file);
}

export async function readFixture(file: string): Promise<SeedFixture> {
  const parsed = JSON.parse(await fs.readFile(file, "utf8")) as SeedFixture;
  if (parsed.version !== FIXTURE_VERSION)
    throw new Error(`Unsupported fixture version: ${String(parsed.version)}`);
  return parsed;
}

export async function writeFixture(file: string, fixture: SeedFixture) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(`${file}\n`, `${JSON.stringify(fixture, null, 2)}\n`);
}
