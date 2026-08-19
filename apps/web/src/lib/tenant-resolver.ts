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
  /** Explicitly opt in to resolving path tenants without a trusted Host. */
  allowPathFallback?: boolean;
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
type Host = { hostname: string; port?: number };

const parseHost = (value = ""): Host | null => {
  const input = value.trim().toLowerCase();
  if (!input) return null;
  const match = input.match(/^([^:]+)(?::([0-9]+))?$/);
  if (!match || !match[1]) return null;
  if (match[2] !== undefined) {
    const port = Number(match[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { hostname: match[1], port };
  }
  return { hostname: match[1] };
};
const validTenant = (value: string) => /^[a-z0-9][a-z0-9-]*$/.test(value);

export function createTenantResolver(
  config: TenantResolverConfig,
): TenantResolver {
  const trusted = config.trustedHosts.flatMap((value) => {
    const parsed = parseHost(value);
    return parsed ? [parsed] : [];
  });
  const isTrusted = (request: Host) =>
    trusted.some((allowed) => {
      const hostnameMatch = allowed.hostname.startsWith("*.")
        ? request.hostname.endsWith(allowed.hostname.slice(1)) &&
          request.hostname !== allowed.hostname.slice(2)
        : request.hostname === allowed.hostname;
      return (
        hostnameMatch &&
        (allowed.port === undefined || request.port === allowed.port)
      );
    });
  const domains = Object.fromEntries(
    Object.entries(config.domains ?? {}).flatMap(([tenant, domain]) => {
      const parsed = parseHost(domain);
      return parsed
        ? [
            [
              parsed.hostname,
              {
                tenant,
                port: parsed.port,
                publicHost: domain.trim().toLowerCase(),
              },
            ] as const,
          ]
        : [];
    }),
  );
  const baseDomainHost = parseHost(config.baseDomain);
  const baseDomain = baseDomainHost?.hostname;

  function resolve(request: TenantResolverRequest): TenantResolution | null {
    const pathname = cleanPath(request.pathname);
    const requestHost = parseHost(request.host);
    const host = requestHost?.hostname;
    const trustedRequest = requestHost ? isTrusted(requestHost) : false;
    if (
      (!host || !trustedRequest) &&
      !(config.strategy === "path" && config.allowPathFallback)
    )
      return null;
    if (config.strategy === "path") {
      const tenant = pathname.split("/")[1];
      return tenant && validTenant(tenant)
        ? { tenant, pathname, strategy: "path" }
        : null;
    }
    if (!host) return null;
    if (config.strategy === "domain") {
      const mapping = domains[host];
      return mapping &&
        (mapping.port === undefined || mapping.port === requestHost?.port) &&
        validTenant(mapping.tenant)
        ? {
            tenant: mapping.tenant,
            pathname,
            strategy: "domain",
            publicHost: mapping.publicHost,
          }
        : null;
    }
    if (!baseDomain || !host.endsWith(`.${baseDomain}`)) return null;
    if (
      baseDomainHost?.port !== undefined &&
      baseDomainHost.port !== requestHost?.port
    )
      return null;
    const tenant = host.slice(0, -(baseDomain.length + 1));
    return tenant && !tenant.includes(".") && validTenant(tenant)
      ? {
          tenant,
          pathname,
          strategy: "subdomain",
          publicHost: baseDomainHost?.port
            ? `${tenant}.${baseDomain}:${baseDomainHost.port}`
            : `${tenant}.${baseDomain}`,
        }
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
const boolean = (value?: string) => value?.toLowerCase() === "true";

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
    allowPathFallback: boolean(env.TENANT_ALLOW_PATH_FALLBACK),
  });
}
