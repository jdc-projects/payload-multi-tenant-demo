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
  revalidateTag(`page:${body.tenant}:${slug}`, "max");
  revalidatePath(`/${body.tenant}/${slug}`);
  return Response.json({ revalidated: true });
}
