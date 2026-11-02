import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAnyRole, requireAuthenticatedSession } from '../../../../lib/auth.js';
import { getSql } from '../../../../lib/db.js';
import { experienceInputSchema } from '../../../../lib/experience.js';
import { ApiError, enforceOrigin, handlePreflight, parseBody, requireMethod, sendError, sendJson } from '../../../../lib/http.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req,res) || !enforceOrigin(req,res) || !requireMethod(req,res,'GET','POST')) return;
  try {
    requireAnyRole(await requireAuthenticatedSession(req), ['superuser','editor']); const sql = getSql();
    if (req.method === 'GET') {
      const rows = await sql`SELECT e.id::text AS id,e.slug,e.company,e.status,e.start_month AS "startMonth",e.end_month AS "endMonth", e.is_current AS "isCurrent", t.title FROM experiences e LEFT JOIN experience_translations t ON t.experience_id=e.id AND t.locale='es-MX' ORDER BY e.start_month DESC NULLS LAST,e.id DESC LIMIT 100`;
      sendJson(res,200,{items: rows}); return;
    }
    const input = parseBody(req,experienceInputSchema);
    const matches = await sql`SELECT count(*)::int AS count FROM skills WHERE id IN (SELECT value::bigint FROM jsonb_array_elements_text(${JSON.stringify(input.skillIds)}::jsonb))`;
    if (Number(matches[0]?.count)!==input.skillIds.length) throw new ApiError(400,'invalid_skill_id','One or more skills do not exist.');
    const rows = await sql`WITH created AS (
      INSERT INTO experiences (slug,company,start_month,end_month,is_current,website_url,logo_url,status,development_areas,published_at)
      VALUES (${input.slug},${input.company},${input.startMonth},${input.endMonth},${input.isCurrent},${input.websiteUrl},${input.logoUrl},${input.status}::content_status,${JSON.stringify(input.developmentAreas)}::jsonb,CASE WHEN ${input.status} = 'published' THEN now() ELSE NULL END) RETURNING id
    ), translations AS (
      INSERT INTO experience_translations(experience_id,locale,title,summary,description)
      SELECT created.id,t.locale,t.title,t.summary,t.description FROM created CROSS JOIN jsonb_to_recordset(${JSON.stringify(input.translations)}::jsonb) AS t(locale text,title text,summary text,description text)
    ), links AS (
      INSERT INTO experience_skills(experience_id,skill_id) SELECT created.id,value::bigint FROM created CROSS JOIN jsonb_array_elements_text(${JSON.stringify(input.skillIds)}::jsonb)
    ) SELECT id::text AS id FROM created`;
    sendJson(res,201,{experience: rows[0]});
  } catch(error) { sendError(res,error); }
}
