import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAnyRole, requireAuthenticatedSession } from '../../../../lib/auth.js';
import { getSql } from '../../../../lib/db.js';
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, parseBody, requireMethod, sendError, sendJson } from '../../../../lib/http.js';

const id = z.string().regex(/^[1-9]\d*$/);
const ids = z.array(id).max(200).refine(values => new Set(values).size === values.length);
const references = z.array(z.object({ id, detail:z.enum(['summary','description']) })).max(100).refine(values => new Set(values.map(value => value.id)).size === values.length);
const overrideKey = z.string().regex(/^(name|headline|summary|email|(?:link|skill):[1-9]\d*|(?:experience|project|learning):[1-9]\d*:(title|organization|dates|summary|description))$/);
const overrideMap = z.record(overrideKey,z.string().max(10000)).refine(value => Object.keys(value).length <= 300);
const content = z.object({
  includeHeadline:z.boolean(), includeSummary:z.boolean(), includeEmail:z.boolean(),
  phone:z.string().max(100), location:z.string().max(160),
  linkIds:ids, skillIds:ids, learningIds:ids, experiences:references, projects:references,
  overrides:z.object({'en-US':overrideMap.optional(),'es-MX':overrideMap.optional()}).optional(),
});
const schema = z.object({ title:z.string().trim().min(1).max(160), locale:z.enum(['es-MX','en-US']), template:z.enum(['harvard','original','modern']), content });
export default async function handler(req:VercelRequest,res:VercelResponse) {
 if(handlePreflight(req,res)||!enforceOrigin(req,res)||!requireMethod(req,res,'GET','POST','PUT','DELETE')) return;
 try {
  const session=await requireAuthenticatedSession(req); requireAnyRole(session,['superuser','editor']);
  const id=getSingleQueryValue(req,'id'); if(id && !/^[1-9]\d*$/.test(id)) throw new ApiError(400,'invalid_id','Invalid resume ID.');
  const sql=getSql();
  if(req.method==='GET') {
   if(id){const rows=await sql`SELECT id::text AS id,title,locale,template,content FROM resume_documents WHERE id=${id} AND owner_user_id=${session.userId}`;if(!rows[0])throw new ApiError(404,'resume_not_found','Resume not found.');sendJson(res,200,{resume:rows[0]});return;}
   const rows=await sql`SELECT id::text AS id,title,locale,template,updated_at AS "updatedAt" FROM resume_documents WHERE owner_user_id=${session.userId} ORDER BY updated_at DESC LIMIT 200`;sendJson(res,200,{items:rows});return;
  }
  if(req.method==='DELETE'){if(!id)throw new ApiError(400,'invalid_id','Resume ID required.'); const rows=await sql`DELETE FROM resume_documents WHERE id=${id} AND owner_user_id=${session.userId} RETURNING id`;if(!rows[0])throw new ApiError(404,'resume_not_found','Resume not found.');sendJson(res,200,{deleted:true});return;}
  const input=parseBody(req,schema);
  if(req.method==='POST'){const rows=await sql`INSERT INTO resume_documents(owner_user_id,title,locale,template,content) VALUES (${session.userId},${input.title},${input.locale},${input.template},${JSON.stringify(input.content)}::jsonb) RETURNING id::text AS id`;sendJson(res,201,{id:rows[0].id});return;}
  if(!id)throw new ApiError(400,'invalid_id','Resume ID required.'); const rows=await sql`UPDATE resume_documents SET title=${input.title},locale=${input.locale},template=${input.template},content=${JSON.stringify(input.content)}::jsonb WHERE id=${id} AND owner_user_id=${session.userId} RETURNING id::text AS id`;if(!rows[0])throw new ApiError(404,'resume_not_found','Resume not found.');sendJson(res,200,{id:rows[0].id});
 }catch(error){sendError(res,error)}
}
