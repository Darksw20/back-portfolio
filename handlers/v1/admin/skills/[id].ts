import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAnyRole, requireAuthenticatedSession } from "../../../../lib/auth.js";
import { getSql } from "../../../../lib/db.js";
import { developmentAreasSchema, skillIconSchema } from "../../../../lib/skill-presentation.js";
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, parseBody, requireMethod, sendError, sendJson } from "../../../../lib/http.js";

const statusSchema = z.enum(["draft", "published", "archived"]);
const groupSchema = z.enum(["soft_skill", "programming_language", "tool", "spoken_language"]);
const translationSchema = z.object({
  locale: z.enum(["es-MX", "en-US"]),
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(5_000).nullable().optional(),
});
const updateSkillSchema = z.object({
  status: statusSchema.optional(),
  iconUrl: skillIconSchema.nullable().optional(),
  developmentAreas: developmentAreasSchema.optional(),
  group: groupSchema.optional(),
  proficiency: z.number().int().min(0).max(100).nullable().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  translations: z.array(translationSchema).min(1).max(2).optional(),
}).refine((input) => Object.keys(input).length > 0, "At least one field is required.");

type SkillRow = { id: string | number; status: "draft" | "published" | "archived"; group_name: string; proficiency: number | null; display_order: number; published_at: string | null; icon_url: string | null; development_areas: Array<{slug: string; es: string; en: string}> };
type TranslationRow = { locale: "es-MX" | "en-US"; name: string; description: string | null };
type TranslationCount = { count: string | number };

function getSkillId(req: VercelRequest): string {
  const id = getSingleQueryValue(req, "id");
  if (!id || !/^\d+$/.test(id)) throw new ApiError(400, "invalid_skill_id", "The skill ID is invalid.");
  return id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET", "PATCH")) return;

  try {
    const session = await requireAuthenticatedSession(req);
    requireAnyRole(session, ["superuser", "editor"]);
    const skillId = getSkillId(req);
    const sql = getSql();

    if (req.method === "GET") {
      const [skillResults, translationResults] = await Promise.all([
        sql`SELECT id, status, group_name, proficiency, display_order, published_at, icon_url, development_areas FROM skills WHERE id = ${skillId} LIMIT 1`,
        sql`SELECT locale, name, description FROM skill_translations WHERE skill_id = ${skillId} ORDER BY locale ASC`,
      ]);
      const skill = (skillResults as SkillRow[])[0];
      if (!skill) throw new ApiError(404, "skill_not_found", "The requested skill does not exist.");
      sendJson(res, 200, { skill: { id: String(skill.id), status: skill.status, group: skill.group_name, proficiency: skill.proficiency, displayOrder: skill.display_order, publishedAt: skill.published_at, iconUrl: skill.icon_url, developmentAreas: skill.development_areas, translations: translationResults as TranslationRow[] } });
      return;
    }

    const input = parseBody(req, updateSkillSchema);
    if (input.translations) {
      const locales = input.translations.map((translation) => translation.locale);
      if (new Set(locales).size !== locales.length) throw new ApiError(400, "duplicate_locale", "Each locale may be provided once.");
      await sql`
        INSERT INTO skill_translations (skill_id, locale, name, description)
        SELECT ${skillId}, translation.locale, translation.name, translation.description
        FROM jsonb_to_recordset(${JSON.stringify(input.translations)}::jsonb) AS translation(locale varchar(10), name varchar(128), description text)
        ON CONFLICT (skill_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
      `;
    }
    if (input.status === "published") {
      const translationResults = (await sql`SELECT count(DISTINCT locale) AS count FROM skill_translations WHERE skill_id = ${skillId} AND locale IN ('es-MX', 'en-US')`) as TranslationCount[];
      if (Number(translationResults[0]?.count ?? 0) !== 2) throw new ApiError(400, "translations_required", "Published skills require es-MX and en-US translations.");
    }
    const skills = (await sql`
      UPDATE skills
      SET icon_url = CASE WHEN ${Object.hasOwn(input, "iconUrl")} THEN ${input.iconUrl ?? null} ELSE icon_url END,
        development_areas = CASE WHEN ${Object.hasOwn(input, "developmentAreas")} THEN ${JSON.stringify(input.developmentAreas ?? [])}::jsonb ELSE development_areas END,
        status = COALESCE(${input.status ?? null}::content_status, status),
        group_name = COALESCE(${input.group ?? null}::skill_group, group_name),
        proficiency = CASE WHEN ${Object.hasOwn(input, "proficiency")} THEN ${input.proficiency ?? null}::smallint ELSE proficiency END,
        display_order = COALESCE(${input.displayOrder ?? null}, display_order),
        published_at = CASE WHEN ${input.status ?? null}::content_status = 'published' AND published_at IS NULL THEN now() WHEN ${input.status ?? null}::content_status IN ('draft', 'archived') THEN NULL ELSE published_at END
      WHERE id = ${skillId}
      RETURNING id, status, group_name, proficiency, display_order, published_at
    `) as SkillRow[];
    const skill = skills[0];
    if (!skill) throw new ApiError(404, "skill_not_found", "The requested skill does not exist.");
    sendJson(res, 200, { skill: { id: String(skill.id), status: skill.status, group: skill.group_name, proficiency: skill.proficiency, displayOrder: skill.display_order, publishedAt: skill.published_at } });
  } catch (error) {
    sendError(res, error);
  }
}
