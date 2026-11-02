// Local adapter for the same handlers deployed as Vercel functions.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import routeRequest from "../handlers/router.js";

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams) query[key] = query[key] === undefined ? value : ([] as string[]).concat(query[key], value);
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 1024 * 1024) { response.writeHead(413); response.end(); return; } chunks.push(chunk); }
  const req = Object.assign(request, { query, body: Buffer.concat(chunks).toString("utf8") || undefined }) as VercelRequest;
  const res = Object.assign(response, {
    status(code: number) { response.statusCode = code; return res; },
    json(body: unknown) { response.end(JSON.stringify(body)); return res; },
  }) as VercelResponse;
  await routeRequest(req, res);
}
const port = Number(process.env.PORT || 3000);
createServer((request, response) => { handle(request, response).catch(error => { console.error(error); if (!response.headersSent) response.writeHead(500); response.end(); }); }).listen(port, "127.0.0.1", () => console.log(`Backend: http://localhost:${port}`));
