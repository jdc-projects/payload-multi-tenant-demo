import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

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
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalize(item)]),
  );
}

export function recordsChanged(existing: unknown, fixture: unknown): boolean {
  return (
    JSON.stringify(normalize(existing)) !== JSON.stringify(normalize(fixture))
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

/** Return every fixture media reference nested in a value. */
export function collectMediaRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectMediaRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const refs = typeof record.ref === "string" ? [record.ref] : [];
  return refs.concat(
    Object.entries(record).flatMap(([key, item]) =>
      key === "ref" ? [] : collectMediaRefs(item),
    ),
  );
}

export type PaginatedResult<T> = {
  docs: T[];
  hasNextPage?: boolean;
  nextPage?: number | null;
};

/** Read all pages from a Payload find operation (Payload defaults to 10, not all records). */
export async function readAllPages<T>(
  find: (page: number) => Promise<PaginatedResult<T>>,
): Promise<T[]> {
  const docs: T[] = [];
  let page = 1;
  do {
    const result = await find(page);
    docs.push(...result.docs);
    if (!result.hasNextPage) break;
    const nextPage = result.nextPage ?? page + 1;
    if (result.docs.length === 0 || nextPage <= page)
      throw new Error(
        `Invalid pagination progress: page ${page} returned ${result.docs.length} records and nextPage ${nextPage}`,
      );
    page = nextPage;
  } while (true);
  return docs;
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
  if (parsed.version !== 1)
    throw new Error(`Unsupported fixture version: ${String(parsed.version)}`);
  return parsed;
}

export async function writeFixture(file: string, fixture: SeedFixture) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  let mode: number | undefined;
  try {
    mode = (await fs.stat(file)).mode & 0o777;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporary, `${JSON.stringify(fixture, null, 2)}\n`, {
      flag: "wx",
      mode: mode ?? 0o666,
    });
    if (mode !== undefined) await fs.chmod(temporary, mode);
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
