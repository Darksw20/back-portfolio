import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import * as catalog from 'simple-icons';
import { z } from 'zod';
import { requireAnyRole, requireAuthenticatedSession } from '../../../lib/auth.js';
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, parseBody, requireMethod, sendError, sendJson } from '../../../lib/http.js';

type Icon = { title:string; slug:string; svg:string; source:string };
const icons = Object.values(catalog) as Icon[];
const schema = z.object({ slug:z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) });
export default async function handler(req:VercelRequest,res:VercelResponse) {
 if (handlePreflight(req,res) || !enforceOrigin(req,res) || !requireMethod(req,res,'GET','POST')) return;
 try {
  requireAnyRole(await requireAuthenticatedSession(req),['superuser','editor']);
  if (req.method === 'GET') {
   const query=(getSingleQueryValue(req,'query') || '').trim().toLowerCase().slice(0,100);
   if (query.length < 2) { sendJson(res,200,{items:[]}); return; }
   const matches=icons.filter(icon=>icon.title.toLowerCase().includes(query) || icon.slug.includes(query)).sort((a,b)=>Number(b.title.toLowerCase()===query)-Number(a.title.toLowerCase()===query) || a.title.localeCompare(b.title)).slice(0,40);
   sendJson(res,200,{items:matches.map(({title,slug,svg,source})=>({title,slug,svg,source}))}); return;
  }
  const {slug}=parseBody(req,schema), icon=icons.find(item=>item.slug===slug);
  if (!icon) throw new ApiError(404,'icon_not_found','No se encontró el icono.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new ApiError(503,'blob_not_configured','El almacenamiento de imágenes aún no está configurado.');
  const svg=icon.svg.replace('<svg ', '<svg fill="#d5eab4" ');
  const blob=await put(`portfolio/skill-icons/${icon.slug}.svg`,svg,{access:'public',contentType:'image/svg+xml',addRandomSuffix:true});
  sendJson(res,200,{url:blob.url,title:icon.title,source:icon.source});
 } catch(error) { sendError(res,error); }
}
