import { postgresAdapter } from "@payloadcms/db-postgres";
import { s3Storage } from "@payloadcms/storage-s3";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";
import { Media, Pages, Tenants, Users } from "./collections.js";
import { ensureMediaBucket } from "./storage.js";

const databaseURL =
  process.env.DATABASE_URL ??
  `${process.env.POSTGRES_PROTOCOL ?? "postgres"}://${process.env.POSTGRES_USER ?? "payload"}:${process.env.POSTGRES_PASSWORD ?? "payload"}@${process.env.POSTGRES_HOST ?? "localhost"}:${process.env.POSTGRES_PORT ?? "5432"}/${process.env.POSTGRES_DB ?? "payload"}`;
const s3Endpoint =
  process.env.S3_ENDPOINT ??
  `${process.env.S3_PROTOCOL ?? "http"}://${process.env.S3_HOST ?? "localhost"}:${process.env.S3_PORT ?? "9000"}`;
const webURL =
  process.env.NEXT_PUBLIC_WEB_URL ??
  `${process.env.WEB_PROTOCOL ?? "http"}://${process.env.WEB_HOST ?? "localhost"}:${process.env.WEB_PORT ?? "3000"}`;
const payloadSecret = process.env.PAYLOAD_SECRET;
if (!payloadSecret)
  throw new Error("PAYLOAD_SECRET must be configured in the environment.");

type TenantPreview = { tenant: string; slug: string };
const previewProtocol = () => process.env.WEB_PROTOCOL ?? "http";
const tenantDomains = (): Record<string, string> => {
  try {
    return JSON.parse(process.env.TENANT_DOMAIN_MAP ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
};
const domainPreviewURL = ({ tenant, slug }: TenantPreview) => {
  const configured = tenantDomains()[tenant];
  if (!configured) return null;
  const domain = configured.includes("://")
    ? configured
    : `${previewProtocol()}://${configured}`;
  return `${domain.replace(/\/$/, "")}/${slug}`;
};
const tenantPreviewURL = ({ tenant, slug }: TenantPreview) => {
  const strategy = process.env.TENANT_RESOLUTION_STRATEGY ?? "path";
  if (strategy === "domain")
    return domainPreviewURL({ tenant, slug }) ?? `${webURL}/${tenant}/${slug}`;
  if (strategy === "subdomain" && process.env.TENANT_BASE_DOMAIN)
    return `${previewProtocol()}://${tenant}.${process.env.TENANT_BASE_DOMAIN}/${slug}`;
  return `${webURL}/${tenant}/${slug}`;
};

export default buildConfig({
  admin: {
    user: "users",
    livePreview: {
      url: ({ data }) =>
        tenantPreviewURL({
          tenant: data?.tenant?.slug ?? "demo1",
          slug: data?.slug ?? "",
        }),
    },
  },
  collections: [Users, Tenants, Pages, Media],
  editor: lexicalEditor(),
  sharp,
  secret: payloadSecret,
  db: postgresAdapter({
    pool: {
      connectionString: databaseURL,
    },
  }),
  plugins: [
    s3Storage({
      collections: { media: true },
      bucket: process.env.S3_BUCKET ?? "payload-media",
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "payload",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "payload-secret",
        },
        endpoint: s3Endpoint,
        region: "us-east-1",
        forcePathStyle: true,
      },
    }),
  ],
  onInit: async (payload) => {
    await ensureMediaBucket();
    const email = process.env.PAYLOAD_ADMIN_EMAIL;
    const password = process.env.PAYLOAD_ADMIN_PASSWORD;
    if (
      email &&
      password &&
      !(await payload.find({ collection: "users", limit: 1 })).docs.length
    )
      await payload.create({
        collection: "users",
        data: { email, password, name: "Demo administrator" },
        overrideAccess: true,
      });
  },
});
