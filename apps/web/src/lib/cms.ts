import { cookies } from "next/headers";

const cmsUrl =
  process.env.NEXT_PUBLIC_CMS_URL ??
  `${process.env.CMS_PROTOCOL ?? "http"}://${process.env.CMS_HOST ?? "localhost"}:${process.env.CMS_PORT ?? "3001"}`;
const cmsRendererToken = process.env.CMS_RENDERER_TOKEN;
const cmsHeaders = cmsRendererToken
  ? { "x-cms-renderer-token": cmsRendererToken }
  : undefined;

export type Page = {
  title: string;
  slug: string;
  tenant: {
    slug: string;
    name: string;
    theme?: { primaryColor?: string; fontFamily?: string };
  };
  layout: Array<Record<string, unknown>>;
};

type Tenant = { slug: string };

export async function getPage(
  tenant: string,
  slug = "",
  preview = false,
): Promise<Page | null> {
  const params = new URLSearchParams({
    where: JSON.stringify({
      and: [{ "tenant.slug": { equals: tenant } }, { slug: { equals: slug } }],
    }),
    depth: "2",
  });
  if (preview) params.set("draft", "true");
  const headers = new Headers(cmsHeaders);
  if (preview) {
    const cookie = await cookies();
    const cookieHeader = cookie.toString();
    if (cookieHeader) headers.set("cookie", cookieHeader);
  }
  const response = await fetch(
    `${cmsUrl}/api/pages?${params}`,
    preview
      ? { headers, cache: "no-store" }
      : { headers, next: { revalidate: 60, tags: [`page:${tenant}:${slug}`] } },
  );
  if (!response.ok) return null;
  return ((await response.json()) as { docs: Page[] }).docs[0] ?? null;
}

export async function getTenants(): Promise<string[]> {
  const response = await fetch(`${cmsUrl}/api/tenants?limit=1000&depth=0`, {
    next: { revalidate: 60, tags: ["tenants"] },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { docs: Tenant[] };
  return data.docs.map((tenant) => tenant.slug);
}

export async function getPagePaths(): Promise<
  Array<{ tenant: string; slug: string[] }>
> {
  const params = new URLSearchParams({
    where: JSON.stringify({ _status: { equals: "published" } }),
    depth: "1",
    limit: "1000",
  });
  try {
    const response = await fetch(`${cmsUrl}/api/pages?${params}`, {
      headers: cmsHeaders,
      next: { revalidate: 60, tags: ["pages"] },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      docs: Array<{ tenant: string | { slug: string }; slug: string }>;
    };
    return data.docs.map((page) => ({
      tenant: typeof page.tenant === "string" ? page.tenant : page.tenant.slug,
      slug: page.slug ? page.slug.split("/") : [],
    }));
  } catch {
    // A standalone build has no CMS to enumerate; dynamic routes render at runtime.
    return [];
  }
}
