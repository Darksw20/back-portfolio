import type { VercelRequest, VercelResponse } from "@vercel/node";
import authSetup from "./v1/auth/setup.js";
import authLogin from "./v1/auth/login.js";
import authSession from "./v1/auth/session.js";
import authLogout from "./v1/auth/logout.js";
import publicProfile from "./v1/public/profile.js";
import publicSkills from "./v1/public/skills.js";
import publicLearning from "./v1/public/learning.js";
import publicProjectAreas from "./v1/public/project-areas.js";
import publicExperiences from "./v1/public/experiences/index.js";
import publicExperience from "./v1/public/experiences/[slug].js";
import adminExperiences from "./v1/admin/experiences/index.js";
import adminExperience from "./v1/admin/experiences/[id].js";
import publicProjects from "./v1/public/projects/index.js";
import publicProject from "./v1/public/projects/[slug].js";
import publicContact from "./v1/public/contact.js";
import skillIcons from "./v1/admin/skill-icons.js";
import imageUpload from "./v1/admin/image-upload.js";
import adminProfile from "./v1/admin/profile.js";
import adminProjects from "./v1/admin/projects/index.js";
import adminProject from "./v1/admin/projects/[id].js";
import adminSkills from "./v1/admin/skills/index.js";
import adminSkill from "./v1/admin/skills/[id].js";
import adminLearning from "./v1/admin/learning/index.js";
import adminLearningEntry from "./v1/admin/learning/[id].js";
import adminResumes from "./v1/admin/resumes/index.js";
import resumeSource from "./v1/admin/resumes/source.js";
import adminContacts from "./v1/admin/contacts/index.js";
import adminContact from "./v1/admin/contacts/[id].js";

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;
const routes: Array<[RegExp, Handler, string?]> = [
  [/^\/v1\/auth\/setup\/?$/, authSetup], [/^\/v1\/auth\/login\/?$/, authLogin], [/^\/v1\/auth\/session\/?$/, authSession], [/^\/v1\/auth\/logout\/?$/, authLogout],
  [/^\/v1\/public\/experiences\/?$/, publicExperiences], [/^\/v1\/public\/experiences\/([^/]+)\/?$/, publicExperience, "slug"], [/^\/v1\/public\/profile\/?$/, publicProfile], [/^\/v1\/public\/skills\/?$/, publicSkills], [/^\/v1\/public\/learning\/?$/, publicLearning], [/^\/v1\/public\/project-areas\/?$/, publicProjectAreas], [/^\/v1\/public\/projects\/?$/, publicProjects], [/^\/v1\/public\/projects\/([^/]+)\/?$/, publicProject, "slug"], [/^\/v1\/public\/contact\/?$/, publicContact],
  [/^\/v1\/admin\/resumes\/source\/?$/, resumeSource], [/^\/v1\/admin\/resumes\/?$/, adminResumes], [/^\/v1\/admin\/resumes\/([^/]+)\/?$/, adminResumes, "id"],
  [/^\/v1\/admin\/skill-icons\/?$/, skillIcons], [/^\/v1\/admin\/image-upload\/?$/, imageUpload], [/^\/v1\/admin\/experiences\/?$/, adminExperiences], [/^\/v1\/admin\/experiences\/([^/]+)\/?$/, adminExperience, "id"], [/^\/v1\/admin\/profile\/?$/, adminProfile], [/^\/v1\/admin\/projects\/?$/, adminProjects], [/^\/v1\/admin\/projects\/([^/]+)\/?$/, adminProject, "id"], [/^\/v1\/admin\/skills\/?$/, adminSkills], [/^\/v1\/admin\/skills\/([^/]+)\/?$/, adminSkill, "id"], [/^\/v1\/admin\/learning\/?$/, adminLearning], [/^\/v1\/admin\/learning\/([^/]+)\/?$/, adminLearningEntry, "id"], [/^\/v1\/admin\/contacts\/?$/, adminContacts], [/^\/v1\/admin\/contacts\/([^/]+)\/?$/, adminContact, "id"],
];

export default async function routeRequest(req: VercelRequest, res: VercelResponse) {
  const rewritten = req.query.__portfolio_route;
  let pathname: string;
  if (rewritten !== undefined) {
    if (Array.isArray(rewritten)) { res.status(400).json({ error: { code: "invalid_path" } }); return; }
    pathname = "/v1/" + rewritten.replace(/^\/+/, "");
    delete req.query.__portfolio_route;
  } else {
    pathname = new URL(req.url ?? "/", "http://localhost").pathname.replace(/^\/api(?=\/)/, "");
  }
  const route = routes.find(([pattern]) => pattern.test(pathname));
  if (!route) { res.status(404).json({ error: { code: "not_found" } }); return; }
  const match = pathname.match(route[0]);
  if (route[2] && match?.[1]) {
    try { req.query[route[2]] = decodeURIComponent(match[1]); }
    catch { res.status(400).json({ error: { code: "invalid_path" } }); return; }
  }
  await route[1](req, res);
}
