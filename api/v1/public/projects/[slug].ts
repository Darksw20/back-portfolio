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

const slugSchema = z.string().min(1).max(128).regex(/^[a-z0-9-]+$/);

type ProjectRow = {
  id: string | number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
};

type TagRow = { slug: string; name: string };
type RoleRow = { slug: string; name: string };
type MediaRow = { url: string; alt_text: string; is_primary: boolean; display_order: number };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET")) {
    return;
  }

  try {
    const locale = getLocale(req);
    const slug = slugSchema.safeParse(getSingleQueryValue(req, "slug"));
    if (!slug.success) {
      throw new ApiError(400, "invalid_slug", "The project slug is invalid.");
    }

    const sql = getSql();
    const projects = (await sql`
      SELECT project.id, translation.slug, translation.title, translation.summary, translation.description,
        project.start_date, project.end_date
      FROM projects project
      INNER JOIN project_translations translation
        ON translation.project_id = project.id AND translation.locale = ${locale}
      WHERE project.status = 'published' AND translation.slug = ${slug.data}
      LIMIT 1
    `) as ProjectRow[];
    const project = projects[0];
    if (!project) {
      throw new ApiError(404, "project_not_found", "The requested project is not available.");
    }

    const [tagResults, roleResults, mediaResults] = await Promise.all([
      sql`
        SELECT tag.slug, tag.name
        FROM project_tags link
        INNER JOIN tags tag ON tag.id = link.tag_id
        WHERE link.project_id = ${project.id}
        ORDER BY tag.name ASC
      `,
      sql`
        SELECT role.slug, role.name
        FROM project_project_roles link
        INNER JOIN project_roles role ON role.id = link.project_role_id
        WHERE link.project_id = ${project.id}
        ORDER BY role.name ASC
      `,
      sql`
        SELECT media.blob_url AS url, link.alt_text, link.is_primary, link.display_order
        FROM project_media link
        INNER JOIN media_assets media ON media.id = link.media_asset_id
        WHERE link.project_id = ${project.id}
        ORDER BY link.is_primary DESC, link.display_order ASC
      `,
    ]);
    const tags = tagResults as TagRow[];
    const roles = roleResults as RoleRow[];
    const media = mediaResults as MediaRow[];

    sendJson(res, 200, {
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      description: project.description,
      startDate: project.start_date,
      endDate: project.end_date,
      tags,
      roles,
      media: media.map((item) => ({
        url: item.url,
        altText: item.alt_text,
        isPrimary: item.is_primary,
        displayOrder: item.display_order,
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
}
