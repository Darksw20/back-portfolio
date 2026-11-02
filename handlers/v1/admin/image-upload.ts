import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { list } from '@vercel/blob';
import { z } from 'zod';
import { requireAnyRole, requireAuthenticatedSession } from '../../../lib/auth.js';
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, parseBody, requireMethod, sendError, sendJson } from '../../../lib/http.js';
const schema=z.object({type:z.enum(['image/jpeg','image/png','image/webp','image/gif']),size:z.number().int().positive().max(10*1024*1024),name:z.string().max(255).optional()});
export default async function handler(req:VercelRequest,res:VercelResponse) {
 if(handlePreflight(req,res)||!enforceOrigin(req,res)||!requireMethod(req,res,'GET','POST')) return;
 try {
  requireAnyRole(await requireAuthenticatedSession(req),['superuser','editor']);
  if(!process.env.BLOB_READ_WRITE_TOKEN) throw new ApiError(503,'blob_not_configured','El almacenamiento de imágenes aún no está configurado.');
  if(req.method==='GET') {
   const cursor=getSingleQueryValue(req,'cursor');
   if(cursor && cursor.length>2048) throw new ApiError(400,'invalid_cursor','Cursor inválido.');
   const result=await list({limit:100,...(cursor?{cursor}:{})});
   sendJson(res,200,{items:result.blobs.filter(blob=>/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(blob.pathname)).map(({url,pathname,size})=>({url,pathname,size})),cursor:result.cursor,hasMore:result.hasMore}); return;
  }
  const input=parseBody(req,schema), extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[input.type];
  const name=(input.name??'imagen').replace(/\.[^.]+$/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70) || 'imagen';
  const pathname=`portfolio/${randomUUID()}-${name}.${extension}`;
  const token=await generateClientTokenFromReadWriteToken({pathname,allowedContentTypes:[input.type],maximumSizeInBytes:10*1024*1024,validUntil:Date.now()+5*60*1000,addRandomSuffix:false,allowOverwrite:false});
  sendJson(res,200,{pathname,token});
 }catch(error){sendError(res,error)}
}
