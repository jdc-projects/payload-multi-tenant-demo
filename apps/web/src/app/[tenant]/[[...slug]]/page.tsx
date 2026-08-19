import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Blocks } from "../../../components/blocks";
import { getPage, getPagePaths } from "../../../lib/cms";
import { accessibleTextColor } from "../../../lib/theme";
import { tenantResolverFromEnv } from "../../../lib/tenant-resolver";

export const dynamicParams = true;
export const revalidate = 60;
export async function generateStaticParams() {
  return getPagePaths();
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; slug?: string[] }>;
}): Promise<Metadata> {
  const { tenant, slug = [] } = await params;
  const path = `/${slug.join("/")}`;
  const page = await getPage(tenant, slug.join("/"));
  const requestHeaders = await headers();
  const resolution = tenantResolverFromEnv().resolve({
    pathname: `/${tenant}${path}`,
    // Middleware rewrites the path but carries the verified public host along
    // so metadata remains canonical to the domain the visitor requested.
    host:
      requestHeaders.get("x-tenant-public-host") ??
      requestHeaders.get("host") ??
      undefined,
  });
  return {
    title: page?.title,
    alternates: resolution
      ? { canonical: tenantResolverFromEnv().canonicalUrl(resolution, path) }
      : undefined,
  };
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
