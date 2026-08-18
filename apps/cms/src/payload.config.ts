import { postgresAdapter } from "@payloadcms/db-postgres";
import { s3Storage } from "@payloadcms/storage-s3";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import { Media, Pages, Tenants, Users } from "./collections";

export default buildConfig({
  admin: {
    user: "users",
    livePreview: {
      url: ({ data }) =>
        `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/${data?.tenant?.slug ?? "demo1"}/${data?.slug ?? ""}`,
    },
  },
  collections: [Users, Tenants, Pages, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET ?? "local-only-secret-change-me",
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } }),
  plugins: [
    s3Storage({
      collections: { media: true },
      bucket: process.env.S3_BUCKET ?? "payload-media",
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "payload",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "payload-secret",
        },
        endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
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
      });
  },
});
