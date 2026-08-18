import { postgresAdapter } from "@payloadcms/db-postgres";
import { s3Storage } from "@payloadcms/storage-s3";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";
import { Media, Pages, Tenants, Users } from "./collections.js";

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

export default buildConfig({
  admin: {
    user: "users",
    livePreview: {
      url: ({ data }) =>
        `${webURL}/${data?.tenant?.slug ?? "demo1"}/${data?.slug ?? ""}`,
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
