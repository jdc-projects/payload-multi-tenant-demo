import { notFound } from "next/navigation";
import { Blocks } from "../../../components/blocks";
import { getPage, getPagePaths } from "../../../lib/cms";
import { accessibleTextColor } from "../../../lib/theme";

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
          "--accent-foreground": accessibleTextColor(
            page.tenant.theme?.primaryColor,
          ),
          "--mantine-font-family":
            page.tenant.theme?.fontFamily ?? "Inter, system-ui, sans-serif",
          "--mantine-heading-font-family":
            page.tenant.theme?.fontFamily ?? "Inter, system-ui, sans-serif",
        } as React.CSSProperties
      }
    >
      <Blocks blocks={page.layout} />
    </main>
  );
}
