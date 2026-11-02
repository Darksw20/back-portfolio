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
  github_url: string | null; website_url: string | null; cover_image_url: string | null; gallery_image_urls: string[];
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
        project.start_date, project.end_date, project.github_url, project.website_url, project.cover_image_url, project.gallery_image_urls
      FROM projects project
      INNER JOIN project_translations translation
        ON translation.project_id = project.id AND translation.locale = ${locale}
      WHERE project.status = 'published' AND EXISTS (
        SELECT 1 FROM project_translations requested WHERE requested.project_id = project.id AND requested.slug = ${slug.data}
      )
      ORDER BY (translation.slug = ${slug.data}) DESC, project.id
      LIMIT 1
    `) as ProjectRow[];
    const project = projects[0];
    if (!project) {
      throw new ApiError(404, "project_not_found", "The requested project is not available.");
    }

    const [tagResults, roleResults, skillResults, mediaResults, slugResults] = await Promise.all([
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
      sql`SELECT skill.id::text AS id, translation.name FROM project_skills link JOIN skills skill ON skill.id = link.skill_id AND skill.status = 'published' JOIN skill_translations translation ON translation.skill_id = skill.id AND translation.locale = ${locale} WHERE link.project_id = ${project.id} ORDER BY translation.name`,
      sql`
        SELECT media.blob_url AS url, link.alt_text, link.is_primary, link.display_order
        FROM project_media link
        INNER JOIN media_assets media ON media.id = link.media_asset_id
        WHERE link.project_id = ${project.id}
        ORDER BY link.is_primary DESC, link.display_order ASC
      `,
      sql`SELECT locale, slug FROM project_translations WHERE project_id = ${project.id} AND locale IN ('es-MX', 'en-US')`,
    ]);
    const tags = tagResults as TagRow[];
    const roles = roleResults as RoleRow[];
    const media = mediaResults as MediaRow[];

    sendJson(res, 200, {
      slug: project.slug,
      localizedSlugs: Object.fromEntries(slugResults.map((row) => [String(row.locale), String(row.slug)])),
      title: project.title,
      summary: project.summary,
      description: project.description,
      startDate: project.start_date,
      endDate: project.end_date,
      githubUrl: project.github_url, websiteUrl: project.website_url, coverImageUrl: project.cover_image_url, galleryImageUrls: project.gallery_image_urls,
      tags,
      roles,
      skills: skillResults,
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
