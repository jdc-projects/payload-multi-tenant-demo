export const cmsUrl =
  process.env.NEXT_PUBLIC_CMS_URL ??
  `${process.env.CMS_PROTOCOL ?? "http"}://${process.env.CMS_HOST ?? "localhost"}:${process.env.CMS_PORT ?? "3001"}`;
