import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAnyRole, requireAuthenticatedSession } from "../../../lib/auth.js";
import { skillIconSchema } from '../../../lib/skill-presentation.js';
import { getSql } from "../../../lib/db.js";
import { enforceOrigin, handlePreflight, parseBody, requireMethod, sendError, sendJson } from "../../../lib/http.js";

const translation = z.object({ locale: z.enum(["es-MX", "en-US"]), displayName: z.string().trim().min(1).max(160), headline: z.string().trim().max(255), biography: z.string().trim().max(20000), workHistory: z.string().trim().max(20000) });
const inputSchema = z.object({ photoUrl: skillIconSchema.nullable().optional(), translations: z.array(translation).length(2).refine(items => new Set(items.map(item => item.locale)).size === 2), socialLinks: z.array(z.object({ platform: z.string().trim().min(1).max(64), url: z.string().url().refine(value => /^https?:\/\//i.test(value)) })).max(30).refine(items => new Set(items.map(item => item.platform)).size === items.length) });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET", "PUT")) return;
  try {
    const session = await requireAuthenticatedSession(req);
    requireAnyRole(session, ["superuser", "editor"]);
    const sql = getSql();
    if (req.method === "GET") {
      const profiles = await sql`SELECT p.id, COALESCE(p.photo_url, m.blob_url) AS "photoUrl" FROM profiles p LEFT JOIN media_assets m ON m.id = p.photo_media_id ORDER BY p.id LIMIT 1`;
      if (!profiles[0]) { sendJson(res, 200, { translations: [], socialLinks: [] }); return; }
      const id = profiles[0].id;
      const translations = await sql`SELECT locale, display_name AS "displayName", headline, biography, work_history AS "workHistory" FROM profile_translations WHERE profile_id = ${id} ORDER BY locale`;
      const socialLinks = await sql`SELECT platform, url FROM social_links WHERE profile_id = ${id} AND is_visible = true ORDER BY display_order, platform`;
      sendJson(res, 200, { translations, socialLinks, photoUrl: profiles[0].photoUrl }); return;
    }
    const input = parseBody(req, inputSchema);
    await sql`WITH existing_profile AS (
      SELECT id FROM profiles ORDER BY id LIMIT 1
    ), new_profile AS (
      INSERT INTO profiles (owner_user_id) SELECT ${session.userId} WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
      ON CONFLICT (owner_user_id) DO UPDATE SET updated_at = now() RETURNING id
    ), profile AS (
      SELECT id FROM existing_profile UNION ALL SELECT id FROM new_profile
    ), photo AS (
      UPDATE profiles SET photo_url = ${input.photoUrl ?? null}, photo_media_id = NULL WHERE id = (SELECT id FROM profile) AND ${input.photoUrl !== undefined}::boolean RETURNING id
    ), translations AS (
      INSERT INTO profile_translations (profile_id, locale, display_name, headline, biography, work_history)
      SELECT profile.id, t.locale, t."displayName", t.headline, t.biography, COALESCE(t."workHistory", '') FROM profile CROSS JOIN jsonb_to_recordset(${JSON.stringify(input.translations)}::jsonb) AS t(locale text, "displayName" text, headline text, biography text, "workHistory" text)
      ON CONFLICT (profile_id, locale) DO UPDATE SET display_name = EXCLUDED.display_name, headline = EXCLUDED.headline, biography = EXCLUDED.biography, work_history = EXCLUDED.work_history, updated_at = now()
    ), links AS (
      INSERT INTO social_links (profile_id, platform, url, display_order, is_visible)
      SELECT profile.id, l.value->>'platform', l.value->>'url', (l.ordinality - 1)::integer, true FROM profile CROSS JOIN jsonb_array_elements(${JSON.stringify(input.socialLinks)}::jsonb) WITH ORDINALITY AS l(value, ordinality)
      ON CONFLICT (profile_id, platform) DO UPDATE SET url = EXCLUDED.url, display_order = EXCLUDED.display_order, is_visible = true, updated_at = now()
    )
    DELETE FROM social_links WHERE profile_id = (SELECT id FROM profile) AND NOT (platform = ANY(${input.socialLinks.map(link => link.platform)}::text[]))`;
    sendJson(res, 200, { saved: true });
  } catch (error) { sendError(res, error); }
}
