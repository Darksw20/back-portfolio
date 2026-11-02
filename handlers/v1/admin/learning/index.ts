import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAnyRole, requireAuthenticatedSession } from "../../../../lib/auth.js";
import { getSql } from "../../../../lib/db.js";
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, parseBody, requireMethod, sendError, sendJson } from "../../../../lib/http.js";

const statusSchema = z.enum(["draft", "published", "archived"]);
const typeSchema = z.enum(["course", "certification", "degree"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const translationSchema = z.object({ locale: z.enum(["es-MX", "en-US"]), title: z.string().trim().min(1).max(180), description: z.string().trim().max(10_000).nullable().optional() });
const createSchema = z.object({ status: statusSchema.default("draft"), type: typeSchema, provider: z.string().trim().min(1).max(160), credentialUrl: z.string().url().max(2_000).nullable().optional(), startedOn: dateSchema.nullable().optional(), completedOn: dateSchema.nullable().optional(), displayOrder: z.number().int().nonnegative().default(0), translations: z.array(translationSchema).min(1).max(2) }).superRefine((entry, context) => {
  const locales = entry.translations.map((translation) => translation.locale);
  if (new Set(locales).size !== locales.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Each locale may be provided once." });
  if (entry.startedOn && entry.completedOn && entry.completedOn < entry.startedOn) context.addIssue({ code: z.ZodIssueCode.custom, message: "completedOn must not be before startedOn." });
  if (entry.status === "published" && !(locales.includes("es-MX") && locales.includes("en-US"))) context.addIssue({ code: z.ZodIssueCode.custom, message: "Published entries require es-MX and en-US translations." });
});
type Row = { id: string | number; status: "draft" | "published" | "archived"; type: string; provider: string; credential_url: string | null; started_on: string | null; completed_on: string | null; display_order: number; title: string | null; total_items: string | number };
function getPage(value: string | undefined, fallback: number, max: number) { if (!value) return fallback; const page = Number(value); if (!Number.isInteger(page) || page < 1 || page > max) throw new ApiError(400, "invalid_pagination", "Pagination parameters are invalid."); return page; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET", "POST")) return;
  try {
    const session = await requireAuthenticatedSession(req); requireAnyRole(session, ["superuser", "editor"]); const sql = getSql();
    if (req.method === "GET") {
      const page = getPage(getSingleQueryValue(req, "page"), 1, 10_000), pageSize = getPage(getSingleQueryValue(req, "pageSize"), 20, 100), statusValue = getSingleQueryValue(req, "status"), typeValue = getSingleQueryValue(req, "type"), status = statusValue ? statusSchema.safeParse(statusValue) : undefined, type = typeValue ? typeSchema.safeParse(typeValue) : undefined;
      if ((status && !status.success) || (type && !type.success)) throw new ApiError(400, "invalid_filter", "One or more learning-entry filters are invalid.");
      const query = (getSingleQueryValue(req, "query") ?? "").trim().slice(0, 100), offset = (page - 1) * pageSize;
      const entries = (await sql`SELECT entry.id, entry.status, entry.type, entry.provider, entry.credential_url, entry.started_on, entry.completed_on, entry.display_order, translation.title, count(*) OVER() AS total_items FROM learning_entries entry LEFT JOIN learning_translations translation ON translation.learning_entry_id = entry.id AND translation.locale = 'es-MX' WHERE (${status?.data ?? null}::content_status IS NULL OR entry.status = ${status?.data ?? null}::content_status) AND (${type?.data ?? null}::learning_type IS NULL OR entry.type = ${type?.data ?? null}::learning_type) AND (${query} = '' OR translation.title ILIKE '%' || ${query} || '%' OR entry.provider ILIKE '%' || ${query} || '%') ORDER BY entry.updated_at DESC LIMIT ${pageSize} OFFSET ${offset}`) as Row[];
      const totalItems = entries.length ? Number(entries[0].total_items) : 0;
      sendJson(res, 200, { items: entries.map((entry) => ({ id: String(entry.id), status: entry.status, type: entry.type, provider: entry.provider, credentialUrl: entry.credential_url, startedOn: entry.started_on, completedOn: entry.completed_on, displayOrder: entry.display_order, title: entry.title })), page: { number: page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } }); return;
    }
    const input = parseBody(req, createSchema);
    const entries = (await sql`WITH new_entry AS (INSERT INTO learning_entries (status, type, provider, credential_url, started_on, completed_on, display_order, published_at) VALUES (${input.status}::content_status, ${input.type}::learning_type, ${input.provider}, ${input.credentialUrl ?? null}, ${input.startedOn ?? null}::date, ${input.completedOn ?? null}::date, ${input.displayOrder}, CASE WHEN ${input.status}::content_status = 'published' THEN now() ELSE NULL END) RETURNING id, status, type, provider, credential_url, started_on, completed_on, display_order, published_at), new_translations AS (INSERT INTO learning_translations (learning_entry_id, locale, title, description) SELECT entry.id, translation.locale, translation.title, translation.description FROM new_entry entry CROSS JOIN jsonb_to_recordset(${JSON.stringify(input.translations)}::jsonb) AS translation(locale varchar(10), title varchar(180), description text)) SELECT id, status, type, provider, credential_url, started_on, completed_on, display_order, published_at FROM new_entry`) as Array<Omit<Row, "title" | "total_items"> & { published_at: string | null }>;
    const entry = entries[0]; if (!entry) throw new ApiError(500, "learning_create_failed", "Unable to create the learning entry.");
    sendJson(res, 201, { entry: { id: String(entry.id), status: entry.status, type: entry.type, provider: entry.provider, credentialUrl: entry.credential_url, startedOn: entry.started_on, completedOn: entry.completed_on, displayOrder: entry.display_order, publishedAt: entry.published_at } });
  } catch (error) { sendError(res, error); }
}
