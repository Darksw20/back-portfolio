import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql } from '../../../../lib/db.js';
import { enforceOrigin, handlePreflight, requireMethod, sendError, sendJson } from '../../../../lib/http.js';
import { getLocale } from '../../../../lib/public-query.js';
export default async function handler(req: VercelRequest,res: VercelResponse) {
 if(handlePreflight(req,res)||!enforceOrigin(req,res)||!requireMethod(req,res,'GET')) return;
 try { const locale=getLocale(req); const rows=await getSql()`SELECT e.slug,e.company,e.logo_url AS "logoUrl",e.start_month AS "startMonth",e.end_month AS "endMonth",e.is_current AS "isCurrent",t.title,t.summary FROM experiences e JOIN experience_translations t ON t.experience_id=e.id AND t.locale=${locale} WHERE e.status='published' ORDER BY e.start_month DESC NULLS LAST,e.id DESC LIMIT 100`; sendJson(res,200,{items:rows}); } catch(error) {sendError(res,error)}
}
