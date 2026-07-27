import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAnyRole, requireAuthenticatedSession } from "../../../../lib/auth.js";
import { getSql } from "../../../../lib/db.js";
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

const updateProjectSchema = z.object({
  status: statusSchema.optional(),
  startDate: dateSchema.nullable().optional(),
  endDate: dateSchema.nullable().optional(),
  featuredOrder: z.number().int().nonnegative().nullable().optional(),
  translations: z.array(translationSchema).min(1).max(2).optional(),
  tagIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
  roleIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
}).refine((input) => Object.keys(input).length > 0, "At least one field is required.");

type ProjectRow = {
  id: string | number;
  status: "draft" | "published" | "archived";
  start_date: string | null;
  end_date: string | null;
  featured_order: number | null;
  published_at: string | null;
};

type TranslationRow = {
  locale: "es-MX" | "en-US";
  slug: string;
  title: string;
  summary: string;
  description: string;
};

type TranslationCount = { count: string | number };
type ExistingReference = { id: string | number };

function getProjectId(req: VercelRequest): string {
  const id = getSingleQueryValue(req, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw new ApiError(400, "invalid_project_id", "The project ID is invalid.");
  }
  return id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res)) return;
  if (!requireMethod(req, res, "GET", "PATCH")) return;

  try {
    const session = await requireAuthenticatedSession(req);
    requireAnyRole(session, ["superuser", "editor"]);
    const projectId = getProjectId(req);
    const sql = getSql();

    if (req.method === "GET") {
      const [projectResults, translationResults] = await Promise.all([
        sql`
          SELECT id, status, start_date, end_date, featured_order, published_at
          FROM projects
          WHERE id = ${projectId}
          LIMIT 1
        `,
        sql`
          SELECT locale, slug, title, summary, description
          FROM project_translations
          WHERE project_id = ${projectId}
          ORDER BY locale ASC
        `,
      ]);
      const projects = projectResults as ProjectRow[];
      const translations = translationResults as TranslationRow[];
      const project = projects[0];
      if (!project) throw new ApiError(404, "project_not_found", "The requested project does not exist.");

      sendJson(res, 200, {
        project: {
          id: String(project.id), status: project.status, startDate: project.start_date,
          endDate: project.end_date, featuredOrder: project.featured_order, publishedAt: project.published_at,
          translations,
        },
      });
      return;
    }

    const input = parseBody(req, updateProjectSchema);

    if (input.translations) {
      const locales = input.translations.map((translation) => translation.locale);
      if (new Set(locales).size !== locales.length) {
        throw new ApiError(400, "duplicate_locale", "Each locale may be provided once.");
      }
      await sql`
        INSERT INTO project_translations (project_id, locale, slug, title, summary, description)
        SELECT ${projectId}, translation.locale, translation.slug, translation.title, translation.summary, translation.description
        FROM jsonb_to_recordset(${JSON.stringify(input.translations)}::jsonb)
          AS translation(locale varchar(10), slug varchar(128), title varchar(180), summary varchar(400), description text)
        ON CONFLICT (project_id, locale) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          description = EXCLUDED.description
      `;
    }

    if (input.status === "published") {
      const translations = (await sql`
        SELECT count(DISTINCT locale) AS count
        FROM project_translations
        WHERE project_id = ${projectId} AND locale IN ('es-MX', 'en-US')
      `) as TranslationCount[];
      if (Number(translations[0]?.count ?? 0) !== 2) {
        throw new ApiError(400, "translations_required", "Published projects require es-MX and en-US translations.");
      }
    }

    for (const tagId of input.tagIds ?? []) {
      const tag = (await sql`SELECT id FROM tags WHERE id = ${tagId}`) as ExistingReference[];
      if (!tag[0]) throw new ApiError(400, "invalid_tag_id", "One or more tag IDs do not exist.");
    }
    for (const roleId of input.roleIds ?? []) {
      const role = (await sql`SELECT id FROM project_roles WHERE id = ${roleId}`) as ExistingReference[];
      if (!role[0]) throw new ApiError(400, "invalid_role_id", "One or more role IDs do not exist.");
    }

    const hasStartDate = Object.hasOwn(input, "startDate");
    const hasEndDate = Object.hasOwn(input, "endDate");
    const hasFeaturedOrder = Object.hasOwn(input, "featuredOrder");
    const projects = (await sql`
      UPDATE projects
      SET
        status = COALESCE(${input.status ?? null}::content_status, status),
        start_date = CASE WHEN ${hasStartDate} THEN ${input.startDate ?? null}::date ELSE start_date END,
        end_date = CASE WHEN ${hasEndDate} THEN ${input.endDate ?? null}::date ELSE end_date END,
        featured_order = CASE WHEN ${hasFeaturedOrder} THEN ${input.featuredOrder ?? null} ELSE featured_order END,
        published_at = CASE
          WHEN ${input.status ?? null}::content_status = 'published' AND published_at IS NULL THEN now()
          WHEN ${input.status ?? null}::content_status IN ('draft', 'archived') THEN NULL
          ELSE published_at
        END
      WHERE id = ${projectId}
      RETURNING id, status, start_date, end_date, featured_order, published_at
    `) as ProjectRow[];
    const project = projects[0];
    if (!project) throw new ApiError(404, "project_not_found", "The requested project does not exist.");

    if (Object.hasOwn(input, "tagIds")) {
      await sql`DELETE FROM project_tags WHERE project_id = ${projectId}`;
      for (const tagId of input.tagIds ?? []) {
        await sql`INSERT INTO project_tags (project_id, tag_id) VALUES (${projectId}, ${tagId})`;
      }
    }
    if (Object.hasOwn(input, "roleIds")) {
      await sql`DELETE FROM project_project_roles WHERE project_id = ${projectId}`;
      for (const roleId of input.roleIds ?? []) {
        await sql`INSERT INTO project_project_roles (project_id, project_role_id) VALUES (${projectId}, ${roleId})`;
      }
    }

    sendJson(res, 200, {
      project: {
        id: String(project.id), status: project.status, startDate: project.start_date,
        endDate: project.end_date, featuredOrder: project.featured_order, publishedAt: project.published_at,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}
