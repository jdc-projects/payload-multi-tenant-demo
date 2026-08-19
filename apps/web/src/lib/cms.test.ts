import { afterEach, describe, expect, it, vi } from "vitest";
import { getTenants } from "./cms";
import { createTenantResolver } from "./tenant-resolver";

afterEach(() => vi.unstubAllGlobals());

describe("tenant mapping", () => {
  it("contains the three deterministic demo tenants", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            docs: [{ slug: "demo1" }, { slug: "demo2" }, { slug: "demo3" }],
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(getTenants()).resolves.toEqual(["demo1", "demo2", "demo3"]);
  });
});

describe("tenant resolver", () => {
  const config = {
    trustedHosts: ["example.test", "*.example.test"],
    canonicalBaseUrl: "https://example.test",
  };

  it("keeps path resolution as the default route contract", () => {
    const resolver = createTenantResolver({ ...config, strategy: "path" });
    expect(
      resolver.resolve({ pathname: "/demo2/about", host: "example.test" }),
    ).toMatchObject({ tenant: "demo2", pathname: "/demo2/about" });
    expect(
      resolver.resolve({ pathname: "/demo2/about", host: "evil.test" }),
    ).toBeNull();
  });

  it("requires explicit configuration before falling back on an untrusted path host", () => {
    const resolver = createTenantResolver({ ...config, strategy: "path" });
    expect(
      resolver.resolve({ pathname: "/demo1/about", host: "attacker.test" }),
    ).toBeNull();

    const fallbackResolver = createTenantResolver({
      ...config,
      strategy: "path",
      allowPathFallback: true,
    });
    expect(
      fallbackResolver.resolve({
        pathname: "/demo1/about",
        host: "attacker.test",
      }),
    ).toMatchObject({ tenant: "demo1", strategy: "path" });
  });

  it("resolves an explicitly mapped trusted domain", () => {
    const resolver = createTenantResolver({
      ...config,
      strategy: "domain",
      domains: { demo1: "acme.example.test" },
    });
    expect(
      resolver.resolve({ pathname: "/about", host: "acme.example.test" }),
    ).toMatchObject({ tenant: "demo1", strategy: "domain" });
    expect(
      resolver.resolve({ pathname: "/about", host: "other.example.test" }),
    ).toBeNull();
    expect(
      resolver.canonicalUrl(
        resolver.resolve({ pathname: "/about", host: "acme.example.test" })!,
        "/about",
      ),
    ).toBe("https://acme.example.test/about");
  });

  it("does not echo a request port in canonical URLs", () => {
    const resolver = createTenantResolver({
      ...config,
      strategy: "domain",
      domains: { demo1: "acme.example.test" },
    });
    const resolution = resolver.resolve({
      pathname: "/about",
      host: "acme.example.test:4444",
    });
    expect(resolution).toMatchObject({ publicHost: "acme.example.test" });
    expect(resolver.canonicalUrl(resolution!, "/about")).toBe(
      "https://acme.example.test/about",
    );
    expect(
      resolver.resolve({ pathname: "/about", host: "acme.example.test:bad" }),
    ).toBeNull();
  });

  it("resolves trusted subdomains and produces canonical and preview URLs", () => {
    const resolver = createTenantResolver({
      ...config,
      strategy: "subdomain",
      baseDomain: "example.test",
      previewBaseUrl: "http://localhost:3000",
    });
    const resolution = resolver.resolve({
      pathname: "/about",
      host: "demo3.example.test",
    });
    expect(resolution?.tenant).toBe("demo3");
    expect(resolver.canonicalUrl(resolution!, "/about")).toBe(
      "https://demo3.example.test/about",
    );
    expect(resolver.previewUrl("demo3", "/about")).toBe(
      "http://localhost:3000/demo3/about",
    );
  });
});
