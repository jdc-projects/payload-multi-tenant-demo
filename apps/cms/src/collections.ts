import type { CollectionConfig } from "payload";
import { pageBlocks } from "./blocks";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email" },
  fields: [{ name: "name", type: "text" }],
};
export const Tenants: CollectionConfig = {
  slug: "tenants",
  admin: { useAsTitle: "name" },
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
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true },
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
  fields: [{ name: "alt", type: "text" }],
};
