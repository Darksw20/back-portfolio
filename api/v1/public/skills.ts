import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../../../lib/db.js";
import { enforceOrigin, handlePreflight, requireMethod, sendError, sendJson } from "../../../lib/http.js";
import { getLocale } from "../../../lib/public-query.js";

type SkillRow = {
  id: string | number;
  group_name: string;
  proficiency: number;
  name: string;
  description: string | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET")) {
    return;
  }

  try {
    const locale = getLocale(req);
    const skills = (await getSql()`
      SELECT s.id, s.group_name, s.proficiency, st.name, st.description
      FROM skills s
      INNER JOIN skill_translations st ON st.skill_id = s.id AND st.locale = ${locale}
      WHERE s.status = 'published'
      ORDER BY s.group_name ASC, s.display_order ASC, st.name ASC
    `) as SkillRow[];

    sendJson(res, 200, {
      items: skills.map((skill) => ({
        id: String(skill.id),
        group: skill.group_name,
        proficiency: skill.proficiency,
        name: skill.name,
        description: skill.description,
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
}
