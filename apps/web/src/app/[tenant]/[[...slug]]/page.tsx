import { notFound } from "next/navigation";
import { Blocks } from "../../../components/blocks";
import { getPage, getPagePaths } from "../../../lib/cms";

export const dynamicParams = true;
export const revalidate = 60;
export async function generateStaticParams() {
  return getPagePaths();
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
        {
          "--accent": page.tenant.theme?.primaryColor ?? "#4c1d95",
          fontFamily: page.tenant.theme?.fontFamily,
        } as React.CSSProperties
      }
    >
      <Blocks blocks={page.layout} />
    </main>
  );
}
