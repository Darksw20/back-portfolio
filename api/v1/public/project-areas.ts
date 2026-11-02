import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../../../lib/db.js";
import { enforceOrigin, handlePreflight, requireMethod, sendError, sendJson } from "../../../lib/http.js";
import { getLocale } from "../../../lib/public-query.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET")) return;
  try {
    const locale = getLocale(req);
    const rows = await getSql()`
      SELECT DISTINCT ON (area->>'slug') area->>'slug' AS slug,
        CASE WHEN ${locale} = 'en-US' THEN area->>'en' ELSE area->>'es' END AS name
      FROM projects p
      JOIN project_translations translation ON translation.project_id = p.id AND translation.locale = ${locale}
      CROSS JOIN LATERAL jsonb_array_elements(p.development_areas) area
      WHERE p.status = 'published' AND area->>'slug' IS NOT NULL
      ORDER BY area->>'slug', p.id
    `;
    sendJson(res, 200, { items: rows });
  } catch (error) { sendError(res, error); }
}
