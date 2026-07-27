import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../../../lib/db.js";
import { ApiError, enforceOrigin, handlePreflight, requireMethod, sendError, sendJson } from "../../../lib/http.js";
import { getLocale } from "../../../lib/public-query.js";

type ProfileRow = {
  id: string | number;
  locale: string;
  display_name: string;
  headline: string;
  biography: string;
  photo_url: string | null;
};

type SocialLinkRow = {
  platform: string;
  url: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET")) {
    return;
  }

  try {
    const locale = getLocale(req);
    const sql = getSql();
    const profiles = (await sql`
      SELECT p.id, pt.locale, pt.display_name, pt.headline, pt.biography, media.blob_url AS photo_url
      FROM profiles p
      INNER JOIN profile_translations pt ON pt.profile_id = p.id AND pt.locale = ${locale}
      LEFT JOIN media_assets media ON media.id = p.photo_media_id
      LIMIT 1
    `) as ProfileRow[];
    const profile = profiles[0];
    if (!profile) {
      throw new ApiError(404, "profile_not_found", "The requested profile is not available.");
    }

    const socialLinks = (await sql`
      SELECT platform, url
      FROM social_links
      WHERE profile_id = ${profile.id} AND is_visible = true
      ORDER BY display_order ASC, platform ASC
    `) as SocialLinkRow[];

    sendJson(res, 200, {
      locale: profile.locale,
      displayName: profile.display_name,
      headline: profile.headline,
      biography: profile.biography,
      photoUrl: profile.photo_url,
      socialLinks: socialLinks.map((link) => ({ platform: link.platform, url: link.url })),
    });
  } catch (error) {
    sendError(res, error);
  }
}
