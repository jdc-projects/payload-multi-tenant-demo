import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type StorageClient = {
  send: (command: CreateBucketCommand | HeadBucketCommand) => Promise<unknown>;
};

export function createStorageClient() {
  const endpoint =
    process.env.S3_ENDPOINT ??
    `${process.env.S3_PROTOCOL ?? "http"}://${process.env.S3_HOST ?? "localhost"}:${process.env.S3_PORT ?? "9000"}`;

  return new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "payload",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "payload-secret",
    },
  });
}

/** Create the media bucket when needed, then always verify that it is usable. */
export async function ensureMediaBucket(
  client: StorageClient = createStorageClient(),
  bucket = process.env.S3_BUCKET ?? "payload-media",
) {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    // RustFS returns BucketAlreadyOwnedByYou (and some S3 implementations use
    // BucketAlreadyExists) for the idempotent create case. Do not hide other
    // errors: a CMS without writable media storage must fail at startup.
    const typedError = error as { name?: string; Code?: string };
    const code = typedError.name ?? typedError.Code;
    if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists")
      throw error;
  }

  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  return bucket;
}
