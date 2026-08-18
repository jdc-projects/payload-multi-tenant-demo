import type { CollectionConfig } from "payload";
import { pageBlocks } from "./blocks.js";

type TenantUser = { tenant?: string | { id: string } };

const authenticated = ({ req }: { req: { user?: unknown } }) =>
  Boolean(req.user);
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
  admin: { useAsTitle: "title" },
  access: {
    read: pageRead,
    create: authenticated,
    update: tenantScope,
    delete: tenantScope,
  },
  hooks: { beforeChange: [enforceTenantWrite] },
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
  upload: { mimeTypes: ["image/*", "video/*"] },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [{ name: "alt", type: "text" }],
};
