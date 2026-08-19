import type { CollectionConfig } from "payload";
import { pageBlocks } from "./blocks.js";

const webURL =
  process.env.NEXT_PUBLIC_WEB_URL ??
  `${process.env.PROXY_PROTOCOL ?? "http"}://${process.env.PROXY_HOST ?? "localhost"}:${process.env.PROXY_PORT ?? "8888"}`;
const revalidationSecret = process.env.REVALIDATION_SECRET;

type TenantUser = { tenant?: string | { id: string } };

const authenticated = ({ req }: { req: { user?: unknown } }) =>
  Boolean(req.user);
const MAX_MEDIA_SIZE = 25 * 1024 * 1024;
export function validateMediaUpload(file: unknown) {
  const candidate = file as {
    data?: unknown;
    mimetype?: unknown;
    size?: unknown;
  };
  if (
    typeof candidate.mimetype !== "string" ||
    !/^(image|video)\//.test(candidate.mimetype)
  )
    throw new Error("Media must be an image or video.");
  const size =
    typeof candidate.size === "number"
      ? candidate.size
      : Buffer.isBuffer(candidate.data)
        ? candidate.data.length
        : undefined;
  if (typeof size !== "number" || size > MAX_MEDIA_SIZE)
    throw new Error("Media must be 25 MiB or smaller.");
}
const tenantScope = ({ req }: { req: { user?: unknown } }) => {
  if (!req.user) return false;
  const tenant = (req.user as TenantUser).tenant;
  if (!tenant) return true;
  return {
    tenant: { equals: typeof tenant === "string" ? tenant : tenant.id },
  };
};

const rendererToken = process.env.CMS_RENDERER_TOKEN;
const rendererAccess = ({ req }: { req: { headers?: Headers } }) =>
  Boolean(
    rendererToken && req.headers?.get("x-cms-renderer-token") === rendererToken,
  );
const pageRead = ({ req }: { req: { user?: unknown; headers?: Headers } }) => {
  if (req.user) return tenantScope({ req });
  if (rendererAccess({ req })) return { _status: { equals: "published" } };
  return false;
};

const revalidationTimeoutMs = 5_000;
const revalidationPollMs = 250;

type PageSnapshot = { tenant?: any; slug?: string };

const resolveTenantSlug = async (tenant: any, req: any) => {
  if (!tenant) return undefined;
  if (typeof tenant !== "string" && typeof tenant.slug === "string")
    return tenant.slug;
  const tenantID = typeof tenant === "string" ? tenant : tenant.id;
  if (!tenantID) return undefined;
  try {
    const record = await req.payload.findByID({
      collection: "tenants",
      id: tenantID,
      depth: 0,
      overrideAccess: true,
    });
    return record.slug;
  } catch {
    // A tenant ID is not a route segment. Never notify with it when resolving
    // the relationship failed (for example while a transaction is rolling
    // back); the next successful save can safely retry the invalidation.
    return undefined;
  }
};

/**
 * Payload collection hooks run inside the write transaction. Store the
 * notification in an outbox in that same transaction; the worker below only
 * sees it after Postgres commits, so invalidation cannot race the write.
 */
const revalidateWebPage = async ({
  doc,
  previousDoc,
  req,
}: {
  doc: any;
  previousDoc?: any;
  req: any;
}) => {
  if (!revalidationSecret) return doc;

  const snapshots: PageSnapshot[] = [doc];
  if (previousDoc) snapshots.push(previousDoc);
  for (const snapshot of snapshots) {
    const tenant = await resolveTenantSlug(snapshot.tenant, req);
    if (!tenant) continue;
    await req.payload.create({
      collection: "revalidation-events",
      data: { tenant, slug: snapshot.slug ?? "" },
      overrideAccess: true,
      req,
    });
  }
  return doc;
};

export const startRevalidationWorker = (payload: any) => {
  const process = async (): Promise<void> => {
    try {
      const events = await payload.find({
        collection: "revalidation-events",
        limit: 20,
        sort: "createdAt",
        overrideAccess: true,
      });
      for (const event of events.docs) {
        const tenant = event.tenant as string;
        const slug = (event.slug as string | undefined) ?? "";
        const response = await fetch(`${webURL}/api/revalidate`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${revalidationSecret}`,
          },
          body: JSON.stringify({ tenant, slug }),
          signal: AbortSignal.timeout(revalidationTimeoutMs),
        }).catch(() => undefined);
        if (response?.ok)
          await payload.delete({
            collection: "revalidation-events",
            id: event.id,
            overrideAccess: true,
          });
      }
    } catch {
      // Keep events in the outbox and retry after the next poll.
    }
    setTimeout(() => void process(), revalidationPollMs);
  };
  void process();
};

export const RevalidationEvents: CollectionConfig = {
  slug: "revalidation-events",
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: { hidden: true },
  fields: [
    { name: "tenant", type: "text", required: true },
    { name: "slug", type: "text", defaultValue: "" },
  ],
};

export const enforceTenantWrite = ({
  req,
  data,
  originalDoc,
}: {
  req: { user?: unknown };
  data: { tenant?: string | { id: string } };
  originalDoc?: { tenant?: string | { id: string } };
}) => {
  const userTenant = req.user ? (req.user as TenantUser).tenant : undefined;
  if (!userTenant) return data;
  const tenant = data.tenant ?? originalDoc?.tenant;
  if (!tenant) throw new Error("A tenant is required for this content.");
  const userTenantID =
    typeof userTenant === "string" ? userTenant : userTenant.id;
  const dataTenantID = typeof tenant === "string" ? tenant : tenant.id;
  if (userTenantID !== dataTenantID)
    throw new Error("You cannot modify content for another tenant.");
  return data;
};

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email" },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: "name", type: "text" },
    { name: "tenant", type: "relationship", relationTo: "tenants" },
  ],
};
export const Tenants: CollectionConfig = {
  slug: "tenants",
  admin: { useAsTitle: "name" },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true },
    {
      name: "theme",
      type: "group",
      fields: [
        { name: "primaryColor", type: "text", required: true },
        { name: "fontFamily", type: "text" },
      ],
    },
  ],
};
export const Pages: CollectionConfig = {
  slug: "pages",
  versions: { drafts: true },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "tenant", "slug", "_status", "updatedAt"],
    components: {
      beforeListTable: [{ path: "./src/components/pages/tenant-filter.tsx" }],
    },
  },
  access: {
    read: pageRead,
    create: authenticated,
    update: tenantScope,
    delete: tenantScope,
  },
  hooks: {
    beforeChange: [enforceTenantWrite],
    afterChange: [revalidateWebPage],
    afterDelete: [revalidateWebPage],
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", defaultValue: "" },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      index: true,
    },
    { name: "layout", type: "blocks", blocks: pageBlocks, required: true },
  ],
};
export const Media: CollectionConfig = {
  slug: "media",
  upload: {
    mimeTypes: ["image/*", "video/*"],
  },
  hooks: {
    beforeValidate: [
      ({ req }) => {
        if (req.file) validateMediaUpload(req.file);
      },
    ],
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [{ name: "alt", type: "text" }],
};
