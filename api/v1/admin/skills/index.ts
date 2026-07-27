import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAnyRole, requireAuthenticatedSession } from "../../../../lib/auth.js";
import { getSql } from "../../../../lib/db.js";
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, parseBody, requireMethod, sendError, sendJson } from "../../../../lib/http.js";

const statusSchema = z.enum(["draft", "published", "archived"]);
const groupSchema = z.enum(["soft_skill", "programming_language", "tool", "spoken_language"]);
const translationSchema = z.object({
  locale: z.enum(["es-MX", "en-US"]),
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(5_000).nullable().optional(),
});

const createSkillSchema = z.object({
  status: statusSchema.default("draft"),
  group: groupSchema,
  proficiency: z.number().int().min(0).max(100),
  displayOrder: z.number().int().nonnegative().default(0),
  translations: z.array(translationSchema).min(1).max(2),
}).superRefine((skill, context) => {
  const locales = skill.translations.map((translation) => translation.locale);
  if (new Set(locales).size !== locales.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Each locale may be provided once." });
  }
  if (skill.status === "published" && !(locales.includes("es-MX") && locales.includes("en-US"))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Published skills require es-MX and en-US translations." });
  }
});

type SkillListRow = {
  id: string | number;
  status: "draft" | "published" | "archived";
  group_name: string;
  proficiency: number;
  display_order: number;
  name: string | null;
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
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET", "POST")) return;

  try {
    const session = await requireAuthenticatedSession(req);
    requireAnyRole(session, ["superuser", "editor"]);
    const sql = getSql();

    if (req.method === "GET") {
      const page = getPage(getSingleQueryValue(req, "page"), 1, 10_000);
      const pageSize = getPage(getSingleQueryValue(req, "pageSize"), 20, 100);
      const statusValue = getSingleQueryValue(req, "status");
      const groupValue = getSingleQueryValue(req, "group");
      const status = statusValue ? statusSchema.safeParse(statusValue) : undefined;
      const group = groupValue ? groupSchema.safeParse(groupValue) : undefined;
      if ((status && !status.success) || (group && !group.success)) {
        throw new ApiError(400, "invalid_filter", "One or more skill filters are invalid.");
      }
      const query = (getSingleQueryValue(req, "query") ?? "").trim().slice(0, 100);
      const offset = (page - 1) * pageSize;
      const skills = (await sql`
        SELECT skill.id, skill.status, skill.group_name, skill.proficiency, skill.display_order,
          translation.name, count(*) OVER() AS total_items
        FROM skills skill
        LEFT JOIN skill_translations translation ON translation.skill_id = skill.id AND translation.locale = 'es-MX'
        WHERE (${status?.data ?? null}::content_status IS NULL OR skill.status = ${status?.data ?? null}::content_status)
          AND (${group?.data ?? null}::skill_group IS NULL OR skill.group_name = ${group?.data ?? null}::skill_group)
          AND (${query} = '' OR translation.name ILIKE '%' || ${query} || '%')
        ORDER BY skill.group_name ASC, skill.display_order ASC, skill.updated_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `) as SkillListRow[];
      const totalItems = skills.length ? Number(skills[0].total_items) : 0;
      sendJson(res, 200, {
        items: skills.map((skill) => ({ id: String(skill.id), status: skill.status, group: skill.group_name, proficiency: skill.proficiency, displayOrder: skill.display_order, name: skill.name })),
        page: { number: page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
      });
      return;
    }

    const input = parseBody(req, createSkillSchema);
    const skills = (await sql`
      WITH new_skill AS (
        INSERT INTO skills (status, group_name, proficiency, display_order, published_at)
        VALUES (${input.status}::content_status, ${input.group}::skill_group, ${input.proficiency}, ${input.displayOrder}, CASE WHEN ${input.status}::content_status = 'published' THEN now() ELSE NULL END)
        RETURNING id, status, group_name, proficiency, display_order, published_at
      ), new_translations AS (
        INSERT INTO skill_translations (skill_id, locale, name, description)
        SELECT skill.id, translation.locale, translation.name, translation.description
        FROM new_skill skill
        CROSS JOIN jsonb_to_recordset(${JSON.stringify(input.translations)}::jsonb) AS translation(locale varchar(10), name varchar(128), description text)
      )
      SELECT id, status, group_name, proficiency, display_order, published_at FROM new_skill
    `) as Array<Omit<SkillListRow, "name" | "total_items"> & { published_at: string | null }>;
    const skill = skills[0];
    if (!skill) throw new ApiError(500, "skill_create_failed", "Unable to create the skill.");
    sendJson(res, 201, { skill: { id: String(skill.id), status: skill.status, group: skill.group_name, proficiency: skill.proficiency, displayOrder: skill.display_order, publishedAt: skill.published_at } });
  } catch (error) {
    sendError(res, error);
  }
}
