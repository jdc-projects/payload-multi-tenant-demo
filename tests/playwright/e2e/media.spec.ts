import { expect, test } from "@playwright/test";

const minimalPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

test("authenticated media upload, public retrieval, and delete lifecycle", async ({
  request,
}) => {
  const unauthenticated = await request.post("/api/media", {
    multipart: {
      file: {
        name: "anonymous.png",
        mimeType: "image/png",
        buffer: minimalPng,
      },
    },
  });
  expect(unauthenticated.status()).toBe(403);

  const login = await request.post("/api/users/login", {
    data: {
      email: process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme",
    },
  });
  expect(login.ok()).toBe(true);

  const upload = await request.post("/api/media", {
    multipart: {
      file: {
        name: "lifecycle.png",
        mimeType: "image/png",
        buffer: minimalPng,
      },
      alt: "Lifecycle test image",
    },
  });
  expect(upload.ok()).toBe(true);
  const media = (await upload.json()).doc as { id: string; filename: string };

  const retrieved = await request.get(`/media/${media.filename}`);
  expect(retrieved.ok()).toBe(true);
  expect(retrieved.headers()["content-type"]).toContain("image/png");

  const deleted = await request.delete(`/api/media/${media.id}`);
  expect(deleted.ok()).toBe(true);
  expect((await request.get(`/media/${media.filename}`)).status()).toBe(404);
});

test("media rejects unsupported MIME types", async ({ request }) => {
  const login = await request.post("/api/users/login", {
    data: {
      email: process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme",
    },
  });
  expect(login.ok()).toBe(true);
  const response = await request.post("/api/media", {
    multipart: {
      file: {
        name: "bad.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("bad"),
      },
    },
  });
  expect(response.status()).toBe(400);
});
