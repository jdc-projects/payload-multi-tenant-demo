const cmsUrl = process.env.NEXT_PUBLIC_CMS_URL ?? "http://localhost:3001";

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

export async function getPage(tenant: string, slug = ""): Promise<Page | null> {
  const params = new URLSearchParams({
    where: JSON.stringify({
      and: [{ "tenant.slug": { equals: tenant } }, { slug: { equals: slug } }],
    }),
    depth: "2",
  });
  const response = await fetch(`${cmsUrl}/api/pages?${params}`, {
    next: { revalidate: 30 },
  });
  if (!response.ok) return null;
  return ((await response.json()) as { docs: Page[] }).docs[0] ?? null;
}

export async function getTenants(): Promise<string[]> {
  return ["demo1", "demo2", "demo3"];
}
