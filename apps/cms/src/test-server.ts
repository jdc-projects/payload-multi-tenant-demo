import { createServer } from "node:http";
import config from "./payload.config.js";
import { getPayload } from "payload";

const port = Number(process.env.PORT ?? 3001);
const payload = await getPayload({ config });

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.url === "/health") {
    response.writeHead(200).end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (request.url?.startsWith("/api/pages")) {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const where = JSON.parse(url.searchParams.get("where") ?? "{}");
    const result = await payload.find({
      collection: "pages",
      depth: 2,
      limit: 100,
      where,
    });
    response.writeHead(200).end(JSON.stringify(result));
    return;
  }
  response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`CMS test server listening on http://127.0.0.1:${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
