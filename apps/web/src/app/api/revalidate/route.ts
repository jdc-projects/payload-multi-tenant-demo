import { revalidatePath, revalidateTag } from "next/cache";

const secret = process.env.REVALIDATION_SECRET;

export async function POST(request: Request) {
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Forbidden", { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    tenant?: string;
    slug?: string;
  };
  if (!body.tenant) return new Response("Bad request", { status: 400 });
  const slug = body.slug ?? "";
  // This endpoint is called after a CMS save. Expiring immediately makes the
  // next visitor fetch fresh content instead of serving the stale-while-
  // revalidate response produced by the default "max" profile.
  revalidateTag(`page:${body.tenant}:${slug}`, { expire: 0 });
  revalidatePath(`/${body.tenant}/${slug}`);
  return Response.json({ revalidated: true });
}
