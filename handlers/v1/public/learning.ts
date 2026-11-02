import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSql } from "../../../lib/db.js";
import {
  ApiError,
  enforceOrigin,
  getSingleQueryValue,
  handlePreflight,
  requireMethod,
  sendError,
  sendJson,
} from "../../../lib/http.js";
import { getLocale } from "../../../lib/public-query.js";

const learningTypeSchema = z.enum(["course", "certification", "degree"]);

type LearningRow = {
  id: string | number;
  type: string;
  provider: string;
  credential_url: string | null;
  started_on: string | null;
  completed_on: string | null;
  title: string;
  description: string | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET")) {
    return;
  }

  try {
    const locale = getLocale(req);
    const typeParameter = getSingleQueryValue(req, "type");
    const type = typeParameter ? learningTypeSchema.safeParse(typeParameter) : undefined;
    if (type && !type.success) {
      throw new ApiError(400, "invalid_learning_type", "Unsupported learning entry type.");
    }

    const entries = (await getSql()`
      SELECT
        entry.id, entry.type, entry.provider, entry.credential_url, entry.started_on, entry.completed_on,
        translation.title, translation.description
      FROM learning_entries entry
      INNER JOIN learning_translations translation
        ON translation.learning_entry_id = entry.id AND translation.locale = ${locale}
      WHERE entry.status = 'published'
        AND (${type?.data ?? null}::learning_type IS NULL OR entry.type = ${type?.data ?? null}::learning_type)
      ORDER BY entry.type ASC, entry.display_order ASC, entry.completed_on DESC NULLS LAST
    `) as LearningRow[];

    sendJson(res, 200, {
      items: entries.map((entry) => ({
        id: String(entry.id),
        type: entry.type,
        provider: entry.provider,
        credentialUrl: entry.credential_url,
        startedOn: entry.started_on,
        completedOn: entry.completed_on,
        title: entry.title,
        description: entry.description,
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
}
