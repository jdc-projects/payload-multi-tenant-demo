import { describe, expect, it, vi } from "vitest";
import { ensureMediaBucket } from "./storage.js";

describe("media bucket provisioning", () => {
  it("creates and validates a bucket", async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = { send };

    await ensureMediaBucket(client, "media-test");

    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[0]?.[0].input).toEqual({ Bucket: "media-test" });
    expect(send.mock.calls[1]?.[0].input).toEqual({ Bucket: "media-test" });
    expect(send.mock.calls[2]?.[0].input).toMatchObject({
      Bucket: "media-test",
      Policy: expect.stringContaining('"Action":"s3:GetObject"'),
    });
  });

  it("treats an existing bucket as an idempotent success", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("exists"), {
          name: "BucketAlreadyOwnedByYou",
        }),
      )
      .mockResolvedValueOnce({});

    await expect(ensureMediaBucket({ send }, "media-test")).resolves.toBe(
      "media-test",
    );
  });

  it("does not hide connection or permission errors", async () => {
    const error = new Error("unavailable");
    const client = { send: vi.fn().mockRejectedValue(error) };

    await expect(ensureMediaBucket(client, "media-test")).rejects.toBe(error);
  });
});
