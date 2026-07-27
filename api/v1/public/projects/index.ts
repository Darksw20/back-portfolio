import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSql } from "../../../../lib/db.js";
import {
  ApiError,
  enforceOrigin,
  getSingleQueryValue,
  handlePreflight,
  requireMethod,
  sendError,
  sendJson,
} from "../../../../lib/http.js";
import { getLocale } from "../../../../lib/public-query.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tagsSchema = z.array(z.object({ slug: z.string(), name: z.string() }));

type ProjectListRow = {
  slug: string;
  title: string;
  summary: string;
  start_date: string | null;
  end_date: string | null;
  primary_image_url: string | null;
  tags: unknown;
  total_items: string | number;
};

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ApiError(400, "invalid_pagination", "Pagination parameters are invalid.");
  }
  return parsed;
}

function parseOptionalDate(value: string | undefined, name: string): string | null {
  if (value === undefined || value === "") {
    return null;
  }
  if (!dateSchema.safeParse(value).success) {
    throw new ApiError(400, "invalid_date", `Query parameter ${name} must use YYYY-MM-DD.`);
  }
  return value;
}

function normalizeTags(value: unknown) {
  if (typeof value === "string") {
    try {
      return normalizeTags(JSON.parse(value));
    } catch {
      return [];
    }
  }
  const parsed = tagsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET")) {
    return;
  }

  try {
    const locale = getLocale(req);
    const page = positiveInteger(getSingleQueryValue(req, "page"), 1, 10_000);
    const pageSize = positiveInteger(getSingleQueryValue(req, "pageSize"), 12, 48);
    const query = (getSingleQueryValue(req, "query") ?? "").trim().slice(0, 100);
    const tag = (getSingleQueryValue(req, "tag") ?? "").trim().toLowerCase().slice(0, 96);
    const from = parseOptionalDate(getSingleQueryValue(req, "from"), "from");
    const to = parseOptionalDate(getSingleQueryValue(req, "to"), "to");
    if (from && to && from > to) {
      throw new ApiError(400, "invalid_date_range", "from must not be after to.");
    }

    const offset = (page - 1) * pageSize;
    const rows = (await getSql()`
      SELECT
        translation.slug,
        translation.title,
        translation.summary,
        project.start_date,
        project.end_date,
        primary_media.blob_url AS primary_image_url,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('slug', tag_row.slug, 'name', tag_row.name) ORDER BY tag_row.name)
          FROM project_tags project_tag
          INNER JOIN tags tag_row ON tag_row.id = project_tag.tag_id
          WHERE project_tag.project_id = project.id
        ), '[]'::jsonb) AS tags,
        count(*) OVER() AS total_items
      FROM projects project
      INNER JOIN project_translations translation
        ON translation.project_id = project.id AND translation.locale = ${locale}
      LEFT JOIN project_media primary_link
        ON primary_link.project_id = project.id AND primary_link.is_primary = true
      LEFT JOIN media_assets primary_media ON primary_media.id = primary_link.media_asset_id
      WHERE project.status = 'published'
        AND (${query} = '' OR translation.title ILIKE '%' || ${query} || '%' OR translation.summary ILIKE '%' || ${query} || '%')
        AND (${tag} = '' OR EXISTS (
          SELECT 1
          FROM project_tags filter_link
          INNER JOIN tags filter_tag ON filter_tag.id = filter_link.tag_id
          WHERE filter_link.project_id = project.id AND filter_tag.slug = ${tag}
        ))
        AND (${from}::date IS NULL OR COALESCE(project.end_date, project.start_date) >= ${from}::date)
        AND (${to}::date IS NULL OR project.start_date IS NULL OR project.start_date <= ${to}::date)
      ORDER BY project.featured_order ASC NULLS LAST, project.published_at DESC, translation.title ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `) as ProjectListRow[];

    const totalItems = rows.length > 0 ? Number(rows[0].total_items) : 0;
    sendJson(res, 200, {
      items: rows.map((project) => ({
        slug: project.slug,
        title: project.title,
        summary: project.summary,
        startDate: project.start_date,
        endDate: project.end_date,
        primaryImageUrl: project.primary_image_url,
        tags: normalizeTags(project.tags),
      })),
      page: {
        number: page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}
