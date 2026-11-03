import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAnyRole, requireAuthenticatedSession } from '../../../../lib/auth.js';
import { getSql } from '../../../../lib/db.js';
import { enforceOrigin, getSingleQueryValue, handlePreflight, requireMethod, sendError, sendJson } from '../../../../lib/http.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
 if(handlePreflight(req,res)||!enforceOrigin(req,res)||!requireMethod(req,res,'GET')) return;
 try {
  const session=await requireAuthenticatedSession(req); requireAnyRole(session,['superuser','editor']); const sql=getSql(); const locale=getSingleQueryValue(req,'locale')==='es-MX'?'es-MX':'en-US';
  const [profiles,links,experiences,skills,learning,projects,users]=await Promise.all([
   sql`SELECT display_name AS name,headline,biography FROM profile_translations WHERE locale=${locale} ORDER BY profile_id LIMIT 1`,
   sql`SELECT id::text AS id,platform,url FROM social_links ORDER BY display_order`,
   sql`SELECT e.id::text AS id,e.company,e.development_areas AS "developmentAreas",e.start_month AS "startMonth",e.end_month AS "endMonth",e.is_current AS "isCurrent",t.title,t.summary,t.description FROM experiences e JOIN experience_translations t ON t.experience_id=e.id AND t.locale=${locale} WHERE e.status <> 'archived' ORDER BY e.start_month DESC NULLS LAST,e.id DESC`,
   sql`SELECT s.id::text AS id,s.group_name AS "group",s.development_areas AS "developmentAreas",t.name,t.description FROM skills s JOIN skill_translations t ON t.skill_id=s.id AND t.locale=${locale} WHERE s.status <> 'archived' ORDER BY s.display_order,t.name`,
   sql`SELECT l.id::text AS id,l.provider,l.type,l.started_on AS "startedOn",l.completed_on AS "completedOn",t.title,t.description FROM learning_entries l JOIN learning_translations t ON t.learning_entry_id=l.id AND t.locale=${locale} WHERE l.status <> 'archived' ORDER BY l.display_order,l.id`,
   sql`SELECT p.id::text AS id,p.development_areas AS "developmentAreas",t.title,t.summary,t.description,p.start_date AS "startDate",p.end_date AS "endDate" FROM projects p JOIN project_translations t ON t.project_id=p.id AND t.locale=${locale} WHERE p.status <> 'archived' ORDER BY p.start_date DESC NULLS LAST,p.id DESC`,
   sql`SELECT email FROM users WHERE id=${session.userId}`
  ]);
  sendJson(res,200,{profile:profiles[0]??null,email:users[0]?.email??null,links,experiences,skills,learning,projects});
 } catch(error){sendError(res,error)}
}
