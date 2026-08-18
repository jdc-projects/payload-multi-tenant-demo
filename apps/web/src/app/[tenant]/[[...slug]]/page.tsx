import { notFound } from "next/navigation";
import { Blocks } from "../../../components/blocks";
import { getPage, getTenants } from "../../../lib/cms";

export const dynamicParams = false;
export async function generateStaticParams() {
  return (await getTenants()).map((tenant) => ({
    tenant,
    slug: [] as string[],
  }));
}
export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenant: string; slug?: string[] }>;
}) {
  const { tenant, slug = [] } = await params;
  const page = await getPage(tenant, slug.join("/"));
  if (!page) notFound();
  return (
    <main
      style={
        { "--accent": page.tenant.theme?.primaryColor } as React.CSSProperties
      }
    >
      <Blocks blocks={page.layout} />
    </main>
  );
}
