import { describe, expect, it } from "vitest";
import { enforceTenantWrite, validateMediaUpload } from "./collections.js";

describe("tenant write enforcement", () => {
  it("preserves the existing tenant for partial updates", () => {
    expect(
      enforceTenantWrite({
        req: { user: { tenant: "tenant-1" } },
        data: {},
        originalDoc: { tenant: "tenant-1" },
      }),
    ).toEqual({});
  });

  it("rejects partial updates when the existing record belongs elsewhere", () => {
    expect(() =>
      enforceTenantWrite({
        req: { user: { tenant: "tenant-1" } },
        data: {},
        originalDoc: { tenant: "tenant-2" },
      }),
    ).toThrow("another tenant");
  });
});

describe("media upload validation", () => {
  it("accepts image and video files within the limit", () => {
    expect(() =>
      validateMediaUpload({ mimetype: "image/png", size: 1024 }),
    ).not.toThrow();
    expect(() =>
      validateMediaUpload({ mimetype: "video/mp4", size: 25 * 1024 * 1024 }),
    ).not.toThrow();
  });

  it("rejects other MIME types and oversized files", () => {
    expect(() =>
      validateMediaUpload({ mimetype: "text/plain", size: 1 }),
    ).toThrow("image or video");
    expect(() =>
      validateMediaUpload({
        mimetype: "image/png",
        size: 25 * 1024 * 1024 + 1,
      }),
    ).toThrow("25 MiB");
  });
});
