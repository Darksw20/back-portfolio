import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql } from '../../../../lib/db.js';
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, requireMethod, sendError, sendJson } from '../../../../lib/http.js';
import { getLocale } from '../../../../lib/public-query.js';
export default async function handler(req: VercelRequest,res: VercelResponse) {
 if(handlePreflight(req,res)||!enforceOrigin(req,res)||!requireMethod(req,res,'GET')) return;
 try {const locale=getLocale(req),slug=getSingleQueryValue(req,'slug');if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new ApiError(400,'invalid_slug','Invalid experience slug.'); const sql=getSql();
 const rows=await sql`SELECT e.id,e.slug,e.company,e.logo_url AS "logoUrl",e.start_month AS "startMonth",e.end_month AS "endMonth",e.is_current AS "isCurrent",e.website_url AS "websiteUrl",e.development_areas AS "developmentAreas",t.title,t.summary,t.description FROM experiences e JOIN experience_translations t ON t.experience_id=e.id AND t.locale=${locale} WHERE e.status='published' AND e.slug=${slug} LIMIT 1`;
 if(!rows[0])throw new ApiError(404,'experience_not_found','Experience not found.');const skills=await sql`SELECT s.id::text AS id,t.name FROM experience_skills l JOIN skills s ON s.id=l.skill_id AND s.status='published' JOIN skill_translations t ON t.skill_id=s.id AND t.locale=${locale} WHERE l.experience_id=${rows[0].id} ORDER BY t.name`;
 const {id: _id,...item}=rows[0];sendJson(res,200,{...item,skills}); }catch(error){sendError(res,error)}
}
