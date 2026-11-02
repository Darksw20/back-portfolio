import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAnyRole, requireAuthenticatedSession } from "../../../../lib/auth.js";
import { getSql } from "../../../../lib/db.js";
import { skillIdsSchema } from "../../../../lib/experience.js";
import {
  ApiError,
  enforceOrigin,
  getSingleQueryValue,
  handlePreflight,
  parseBody,
  requireMethod,
  sendError,
  sendJson,
} from "../../../../lib/http.js";

const statusSchema = z.enum(["draft", "published", "archived"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const translationSchema = z.object({
  locale: z.enum(["es-MX", "en-US"]),
  slug: z.string().trim().toLowerCase().min(1).max(128).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(400),
  description: z.string().trim().min(1).max(20_000),
});

const createProjectSchema = z.object({
  status: statusSchema.default("draft"),
  skillIds: skillIdsSchema.default([]),
  startDate: dateSchema.nullable().optional(),
  endDate: dateSchema.nullable().optional(),
  featuredOrder: z.number().int().nonnegative().nullable().optional(),
  translations: z.array(translationSchema).min(1).max(2),
}).superRefine((project, context) => {
  if (project.startDate && project.endDate && project.endDate < project.startDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "endDate must not be before startDate." });
  }
  const locales = project.translations.map((translation) => translation.locale);
  if (new Set(locales).size !== locales.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Each locale may be provided once." });
  }
  if (project.status === "published" && !(locales.includes("es-MX") && locales.includes("en-US"))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Published projects require es-MX and en-US translations." });
  }
});

type ProjectListRow = {
  id: string | number;
  status: "draft" | "published" | "archived";
  start_date: string | null;
  end_date: string | null;
  published_at: string | null;
  title: string | null;
  slug: string | null;
  total_items: string | number;
};

function getPage(value: string | undefined, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new ApiError(400, "invalid_pagination", "Pagination parameters are invalid.");
  }
  return parsed;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res)) return;
  if (!requireMethod(req, res, "GET", "POST")) return;

  try {
    const session = await requireAuthenticatedSession(req);
    requireAnyRole(session, ["superuser", "editor"]);
    const sql = getSql();

    if (req.method === "GET") {
      const page = getPage(getSingleQueryValue(req, "page"), 1, 10_000);
      const pageSize = getPage(getSingleQueryValue(req, "pageSize"), 20, 100);
      const statusValue = getSingleQueryValue(req, "status");
      const status = statusValue ? statusSchema.safeParse(statusValue) : undefined;
      if (status && !status.success) {
        throw new ApiError(400, "invalid_status", "Unsupported project status.");
      }
      const query = (getSingleQueryValue(req, "query") ?? "").trim().slice(0, 100);
      const offset = (page - 1) * pageSize;
      const projects = (await sql`
        SELECT project.id, project.status, project.start_date, project.end_date, project.published_at,
          translation.title, translation.slug, count(*) OVER() AS total_items
        FROM projects project
        LEFT JOIN project_translations translation
          ON translation.project_id = project.id AND translation.locale = 'es-MX'
        WHERE (${status?.data ?? null}::content_status IS NULL OR project.status = ${status?.data ?? null}::content_status)
          AND (${query} = '' OR translation.title ILIKE '%' || ${query} || '%' OR translation.slug ILIKE '%' || ${query} || '%')
        ORDER BY project.updated_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `) as ProjectListRow[];
      const totalItems = projects.length ? Number(projects[0].total_items) : 0;
      sendJson(res, 200, {
        items: projects.map((project) => ({
          id: String(project.id), status: project.status, startDate: project.start_date,
          endDate: project.end_date, publishedAt: project.published_at, title: project.title, slug: project.slug,
        })),
        page: { number: page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
      });
      return;
    }

    const input = parseBody(req, createProjectSchema);
    const matches = await sql`SELECT count(*)::int AS count FROM skills WHERE id IN (SELECT value::bigint FROM jsonb_array_elements_text(${JSON.stringify(input.skillIds)}::jsonb))`;
    if (Number(matches[0]?.count) !== input.skillIds.length) throw new ApiError(400, "invalid_skill_id", "One or more skills do not exist.");
    const projects = (await sql`
      WITH new_project AS (
        INSERT INTO projects (status, start_date, end_date, featured_order, published_at)
        VALUES (
          ${input.status}::content_status,
          ${input.startDate ?? null}::date,
          ${input.endDate ?? null}::date,
          ${input.featuredOrder ?? null},
          CASE WHEN ${input.status}::content_status = 'published' THEN now() ELSE NULL END
        )
        RETURNING id, status, start_date, end_date, published_at
      ), new_translations AS (
        INSERT INTO project_translations (project_id, locale, slug, title, summary, description)
        SELECT project.id, translation.locale, translation.slug, translation.title, translation.summary, translation.description
        FROM new_project project
        CROSS JOIN jsonb_to_recordset(${JSON.stringify(input.translations)}::jsonb)
          AS translation(locale varchar(10), slug varchar(128), title varchar(180), summary varchar(400), description text)
      ), new_skills AS (
        INSERT INTO project_skills(project_id, skill_id)
        SELECT project.id, value::bigint FROM new_project project CROSS JOIN jsonb_array_elements_text(${JSON.stringify(input.skillIds)}::jsonb)
      )
      SELECT id, status, start_date, end_date, published_at FROM new_project
    `) as Array<Omit<ProjectListRow, "title" | "slug" | "total_items">>;
    const project = projects[0];
    if (!project) throw new ApiError(500, "project_create_failed", "Unable to create the project.");

    sendJson(res, 201, {
      project: {
        id: String(project.id), status: project.status, startDate: project.start_date,
        endDate: project.end_date, publishedAt: project.published_at,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}
