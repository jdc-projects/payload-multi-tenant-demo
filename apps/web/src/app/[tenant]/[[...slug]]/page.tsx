import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Blocks } from "../../../components/blocks";
import { getPage, getPagePaths } from "../../../lib/cms";
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
    host: requestHeaders.get("host") ?? undefined,
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
        { "--accent": page.tenant.theme?.primaryColor } as React.CSSProperties
      }
    >
      <Blocks blocks={page.layout} />
    </main>
  );
}
