export type TenantResolutionStrategy = "path" | "domain" | "subdomain";

export type TenantResolverRequest = {
  pathname: string;
  host?: string;
  protocol?: string;
};

export type TenantResolution = {
  tenant: string;
  pathname: string;
  strategy: TenantResolutionStrategy;
  /** The verified public host used to reach this tenant. */
  publicHost?: string;
};

export type TenantResolverConfig = {
  strategy: TenantResolutionStrategy;
  trustedHosts: string[];
  domains?: Record<string, string>;
  baseDomain?: string;
  canonicalBaseUrl?: string;
  previewBaseUrl?: string;
};

export interface TenantResolver {
  resolve(request: TenantResolverRequest): TenantResolution | null;
  canonicalUrl(resolution: TenantResolution, pathname?: string): string;
  previewUrl(tenant: string, pathname?: string): string;
}

const cleanPath = (pathname: string) => {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return path === "/" ? "/" : path.replace(/\/+$/, "") || "/";
};
const cleanHost = (host = "") => host.toLowerCase().split(":")[0];
const validTenant = (value: string) => /^[a-z0-9][a-z0-9-]*$/.test(value);

export function createTenantResolver(
  config: TenantResolverConfig,
): TenantResolver {
  const trusted = config.trustedHosts.flatMap((host) => {
    const cleaned = cleanHost(host);
    return cleaned ? [cleaned] : [];
  });
  const isTrusted = (host: string) =>
    trusted.some((allowed) =>
      allowed.startsWith("*.")
        ? host.endsWith(allowed.slice(1)) && host !== allowed.slice(2)
        : host === allowed,
    );
  const domains = Object.fromEntries(
    Object.entries(config.domains ?? {}).map(([tenant, domain]) => [
      cleanHost(domain),
      tenant,
    ]),
  );
  const baseDomain = cleanHost(config.baseDomain);

  function resolve(request: TenantResolverRequest): TenantResolution | null {
    const pathname = cleanPath(request.pathname);
    const host = cleanHost(request.host);
    const publicHost = (request.host ?? "").toLowerCase();
    if (!host || !isTrusted(host)) return null;
    if (config.strategy === "path") {
      const tenant = pathname.split("/")[1];
      return tenant && validTenant(tenant)
        ? { tenant, pathname, strategy: "path" }
        : null;
    }
    if (config.strategy === "domain") {
      const tenant = domains[host];
      return tenant && validTenant(tenant)
        ? { tenant, pathname, strategy: "domain", publicHost }
        : null;
    }
    if (!baseDomain || !host.endsWith(`.${baseDomain}`)) return null;
    const tenant = host.slice(0, -(baseDomain.length + 1));
    return tenant && !tenant.includes(".") && validTenant(tenant)
      ? { tenant, pathname, strategy: "subdomain", publicHost }
      : null;
  }

  const base = (config.canonicalBaseUrl ?? "").replace(/\/$/, "");
  const preview = (config.previewBaseUrl ?? base).replace(/\/$/, "");
  return {
    resolve,
    canonicalUrl: (resolution, pathname = resolution.pathname) => {
      const path = cleanPath(pathname);
      if (resolution.strategy === "path")
        return `${base}/${resolution.tenant}${path}`;
      if (!resolution.publicHost) return `${base}${path}`;
      try {
        const url = new URL(base);
        url.host = resolution.publicHost;
        return `${url.origin}${path}`;
      } catch {
        return `${base}${path}`;
      }
    },
    previewUrl: (tenant, pathname = "/") =>
      `${preview}/${tenant}${cleanPath(pathname)}`,
  };
}

const list = (value?: string) =>
  (value ?? "").split(",").flatMap((item) => {
    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  });
const jsonMap = (value?: string): Record<string, string> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
};

export function tenantResolverFromEnv(env = process.env): TenantResolver {
  const strategy = (env.TENANT_RESOLUTION_STRATEGY ??
    "path") as TenantResolutionStrategy;
  return createTenantResolver({
    strategy: ["path", "domain", "subdomain"].includes(strategy)
      ? strategy
      : "path",
    trustedHosts: list(env.TENANT_TRUSTED_HOSTS ?? "localhost,127.0.0.1"),
    domains: jsonMap(env.TENANT_DOMAIN_MAP),
    baseDomain: env.TENANT_BASE_DOMAIN,
    canonicalBaseUrl:
      env.NEXT_PUBLIC_WEB_URL ??
      `${env.WEB_PROTOCOL ?? "http"}://${env.WEB_HOST ?? "localhost"}:${env.WEB_PORT ?? "3000"}`,
    previewBaseUrl: env.NEXT_PUBLIC_PREVIEW_URL ?? env.NEXT_PUBLIC_WEB_URL,
  });
}
