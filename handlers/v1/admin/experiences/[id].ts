import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAnyRole, requireAuthenticatedSession } from '../../../../lib/auth.js';
import { getSql } from '../../../../lib/db.js';
import { experienceInputSchema } from '../../../../lib/experience.js';
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, parseBody, requireMethod, sendError, sendJson } from '../../../../lib/http.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
 if (handlePreflight(req,res) || !enforceOrigin(req,res) || !requireMethod(req,res,'GET','PUT')) return;
 try {
  requireAnyRole(await requireAuthenticatedSession(req),['superuser','editor']);
  const id=getSingleQueryValue(req,'id'); if (!id || !/^[1-9]\d*$/.test(id)) throw new ApiError(400,'invalid_id','Invalid experience ID.'); const sql=getSql();
  if (req.method==='GET') {
   const [rows, translations, skills] = await Promise.all([
    sql`SELECT id::text AS id,slug,company,status,start_month AS "startMonth",end_month AS "endMonth",is_current AS "isCurrent",website_url AS "websiteUrl",logo_url AS "logoUrl",development_areas AS "developmentAreas" FROM experiences WHERE id=${id}`,
    sql`SELECT locale,title,summary,description FROM experience_translations WHERE experience_id=${id} ORDER BY locale`,
    sql`SELECT skill_id::text AS id FROM experience_skills WHERE experience_id=${id} ORDER BY skill_id`,
   ]); if(!rows[0]) throw new ApiError(404,'experience_not_found','Experience not found.');
   sendJson(res,200,{experience:{...rows[0],translations,skillIds:skills.map(row=>String(row.id))}}); return;
  }
  const input=parseBody(req,experienceInputSchema);
  const [existing,matches]=await Promise.all([sql`SELECT id FROM experiences WHERE id=${id}`,sql`SELECT count(*)::int AS count FROM skills WHERE id IN (SELECT value::bigint FROM jsonb_array_elements_text(${JSON.stringify(input.skillIds)}::jsonb))`]);
  if(!existing[0]) throw new ApiError(404,'experience_not_found','Experience not found.');
  if(Number(matches[0]?.count)!==input.skillIds.length) throw new ApiError(400,'invalid_skill_id','One or more skills do not exist.');
  await sql.transaction([
   sql`UPDATE experiences SET slug=${input.slug},company=${input.company},start_month=${input.startMonth},end_month=${input.endMonth},is_current=${input.isCurrent},website_url=${input.websiteUrl},logo_url=${input.logoUrl},status=${input.status}::content_status,development_areas=${JSON.stringify(input.developmentAreas)}::jsonb,published_at=CASE WHEN ${input.status}='published' THEN COALESCE(published_at,now()) ELSE NULL END WHERE id=${id}`,
   sql`INSERT INTO experience_translations(experience_id,locale,title,summary,description) SELECT ${id},t.locale,t.title,t.summary,t.description FROM jsonb_to_recordset(${JSON.stringify(input.translations)}::jsonb) AS t(locale text,title text,summary text,description text) ON CONFLICT(experience_id,locale) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,description=EXCLUDED.description`,
   sql`DELETE FROM experience_skills WHERE experience_id=${id}`,
   sql`INSERT INTO experience_skills(experience_id,skill_id) SELECT ${id},value::bigint FROM jsonb_array_elements_text(${JSON.stringify(input.skillIds)}::jsonb)`,
  ]);
  sendJson(res,200,{saved:true});
 } catch(error) { sendError(res,error); }
}
