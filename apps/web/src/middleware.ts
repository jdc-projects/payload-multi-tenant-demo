import { NextResponse, type NextRequest } from "next/server";
import { tenantResolverFromEnv } from "./lib/tenant-resolver";

const resolver = tenantResolverFromEnv();

export function middleware(request: NextRequest) {
  const result = resolver.resolve({
    pathname: request.nextUrl.pathname,
    host: request.headers.get("host") ?? undefined,
    protocol: request.nextUrl.protocol,
  });
  if (!result || result.strategy === "path") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${result.tenant}${result.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
