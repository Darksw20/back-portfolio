// Local adapter for the same handlers deployed as Vercel functions.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import authSetup from "../api/v1/auth/setup.js";
import authLogin from "../api/v1/auth/login.js";
import authSession from "../api/v1/auth/session.js";
import authLogout from "../api/v1/auth/logout.js";
import publicProfile from "../api/v1/public/profile.js";
import publicSkills from "../api/v1/public/skills.js";
import publicLearning from "../api/v1/public/learning.js";
import publicProjectAreas from "../api/v1/public/project-areas.js";
import publicExperiences from "../api/v1/public/experiences/index.js";
import publicExperience from "../api/v1/public/experiences/[slug].js";
import adminExperiences from "../api/v1/admin/experiences/index.js";
import adminExperience from "../api/v1/admin/experiences/[id].js";
import publicProjects from "../api/v1/public/projects/index.js";
import publicProject from "../api/v1/public/projects/[slug].js";
import publicContact from "../api/v1/public/contact.js";
import skillIcons from "../api/v1/admin/skill-icons.js";
import imageUpload from "../api/v1/admin/image-upload.js";
import adminProfile from "../api/v1/admin/profile.js";
import adminProjects from "../api/v1/admin/projects/index.js";
import adminProject from "../api/v1/admin/projects/[id].js";
import adminSkills from "../api/v1/admin/skills/index.js";
import adminSkill from "../api/v1/admin/skills/[id].js";
import adminLearning from "../api/v1/admin/learning/index.js";
import adminLearningEntry from "../api/v1/admin/learning/[id].js";
import adminContacts from "../api/v1/admin/contacts/index.js";
import adminContact from "../api/v1/admin/contacts/[id].js";

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;
const routes: Array<[RegExp, Handler, string?]> = [
  [/^\/v1\/auth\/setup\/?$/, authSetup], [/^\/v1\/auth\/login\/?$/, authLogin], [/^\/v1\/auth\/session\/?$/, authSession], [/^\/v1\/auth\/logout\/?$/, authLogout],
  [/^\/v1\/public\/experiences\/?$/, publicExperiences], [/^\/v1\/public\/experiences\/([^/]+)\/?$/, publicExperience, "slug"], [/^\/v1\/public\/profile\/?$/, publicProfile], [/^\/v1\/public\/skills\/?$/, publicSkills], [/^\/v1\/public\/learning\/?$/, publicLearning], [/^\/v1\/public\/project-areas\/?$/, publicProjectAreas], [/^\/v1\/public\/projects\/?$/, publicProjects], [/^\/v1\/public\/projects\/([^/]+)\/?$/, publicProject, "slug"], [/^\/v1\/public\/contact\/?$/, publicContact],
  [/^\/v1\/admin\/skill-icons\/?$/, skillIcons], [/^\/v1\/admin\/image-upload\/?$/, imageUpload], [/^\/v1\/admin\/experiences\/?$/, adminExperiences], [/^\/v1\/admin\/experiences\/([^/]+)\/?$/, adminExperience, "id"], [/^\/v1\/admin\/profile\/?$/, adminProfile], [/^\/v1\/admin\/projects\/?$/, adminProjects], [/^\/v1\/admin\/projects\/([^/]+)\/?$/, adminProject, "id"], [/^\/v1\/admin\/skills\/?$/, adminSkills], [/^\/v1\/admin\/skills\/([^/]+)\/?$/, adminSkill, "id"], [/^\/v1\/admin\/learning\/?$/, adminLearning], [/^\/v1\/admin\/learning\/([^/]+)\/?$/, adminLearningEntry, "id"], [/^\/v1\/admin\/contacts\/?$/, adminContacts], [/^\/v1\/admin\/contacts\/([^/]+)\/?$/, adminContact, "id"],
];
async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const route = routes.find(([pattern]) => pattern.test(url.pathname));
  if (!route) { response.writeHead(404, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: { code: "not_found" } })); return; }
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams) query[key] = query[key] === undefined ? value : ([] as string[]).concat(query[key], value);
  const match = url.pathname.match(route[0]);
  if (route[2] && match?.[1]) query[route[2]] = decodeURIComponent(match[1]);
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 1024 * 1024) { response.writeHead(413); response.end(); return; } chunks.push(chunk); }
  const req = Object.assign(request, { query, body: Buffer.concat(chunks).toString("utf8") || undefined }) as VercelRequest;
  const res = Object.assign(response, {
    status(code: number) { response.statusCode = code; return res; },
    json(body: unknown) { response.end(JSON.stringify(body)); return res; },
  }) as VercelResponse;
  await route[1](req, res);
}
createServer((request, response) => { handle(request, response).catch(error => { console.error(error); if (!response.headersSent) response.writeHead(500); response.end(); }); }).listen(3000, "127.0.0.1", () => console.log("Backend: http://localhost:3000"));
