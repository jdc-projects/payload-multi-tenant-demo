const cmsUrl =
  process.env.NEXT_PUBLIC_CMS_URL ??
  `${process.env.CMS_PROTOCOL ?? "http"}://${process.env.CMS_HOST ?? "localhost"}:${process.env.CMS_PORT ?? "3001"}`;

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

export async function getPage(tenant: string, slug = ""): Promise<Page | null> {
  const params = new URLSearchParams({
    where: JSON.stringify({
      and: [{ "tenant.slug": { equals: tenant } }, { slug: { equals: slug } }],
    }),
    depth: "2",
  });
  const response = await fetch(`${cmsUrl}/api/pages?${params}`, {
    next: { revalidate: 60, tags: [`page:${tenant}:${slug}`] },
  });
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
  const response = await fetch(`${cmsUrl}/api/pages?${params}`, {
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
}
