import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Blocks } from "../../../components/blocks";
import { getPage, getPagePaths } from "../../../lib/cms";
import { accessibleTextColor } from "../../../lib/theme";
import { tenantResolverFromEnv } from "../../../lib/tenant-resolver";

export const dynamicParams = true;
export const dynamic = "force-dynamic";
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
  const canonicalBaseURL =
    process.env.NEXT_PUBLIC_WEB_URL ??
    `${process.env.WEB_PROTOCOL ?? "http"}://${process.env.WEB_HOST ?? "localhost"}:${process.env.WEB_PORT ?? "3000"}`;
  const canonicalURL = new URL(canonicalBaseURL);
  const resolution = tenantResolverFromEnv().resolve({
    pathname: `/${tenant}${path}`,
    host: canonicalURL.host,
    protocol: canonicalURL.protocol.replace(":", ""),
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
  searchParams,
}: {
  params: Promise<{ tenant: string; slug?: string[] }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { tenant, slug = [] } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";
  const page = await getPage(tenant, slug.join("/"), isPreview);
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
