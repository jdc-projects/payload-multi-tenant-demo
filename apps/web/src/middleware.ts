import { NextResponse, type NextRequest } from "next/server";
import { tenantResolverFromEnv } from "./lib/tenant-resolver";

const resolver = tenantResolverFromEnv();
const hostResolutionMode = ["domain", "subdomain"].includes(
  process.env.TENANT_RESOLUTION_STRATEGY ?? "path",
);

export function middleware(request: NextRequest) {
  const publicHost = request.headers.get("host") ?? undefined;
  const result = resolver.resolve({
    pathname: request.nextUrl.pathname,
    host: publicHost,
    protocol: request.nextUrl.protocol,
  });
  // In host modes, never let an unknown host reach /[tenant]. That route treats
  // a path prefix as authoritative and would otherwise allow tenant selection
  // on an untrusted host.
  if (!result) {
    return hostResolutionMode
      ? new NextResponse("Not Found", { status: 404 })
      : NextResponse.next();
  }
  if (result.strategy === "path") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${result.tenant}${result.pathname}`;
  const headers = new Headers(request.headers);
  headers.set("x-tenant-public-host", result.publicHost ?? publicHost ?? "");
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
