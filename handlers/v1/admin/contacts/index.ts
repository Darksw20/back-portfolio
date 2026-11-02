import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { requireAnyRole, requireAuthenticatedSession } from "../../../../lib/auth.js";
import { getSql } from "../../../../lib/db.js";
import { ApiError, enforceOrigin, getSingleQueryValue, handlePreflight, requireMethod, sendError, sendJson } from "../../../../lib/http.js";

const statusSchema = z.enum(["new", "approved", "rejected", "replied"]);
type ContactRow = { id: string | number; name: string; email: string; subject: string | null; message: string; status: "new" | "approved" | "rejected" | "replied"; created_at: string; total_items: string | number };
function pageValue(value: string | undefined, fallback: number, max: number) { if (!value) return fallback; const page = Number(value); if (!Number.isInteger(page) || page < 1 || page > max) throw new ApiError(400, "invalid_pagination", "Pagination parameters are invalid."); return page; }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "GET")) return;
  try {
    const session = await requireAuthenticatedSession(req); requireAnyRole(session, ["superuser", "editor"]);
    const page = pageValue(getSingleQueryValue(req, "page"), 1, 10_000), pageSize = pageValue(getSingleQueryValue(req, "pageSize"), 20, 100), statusValue = getSingleQueryValue(req, "status"), status = statusValue ? statusSchema.safeParse(statusValue) : undefined;
    if (status && !status.success) throw new ApiError(400, "invalid_status", "Unsupported contact status.");
    const query = (getSingleQueryValue(req, "query") ?? "").trim().slice(0, 100), offset = (page - 1) * pageSize;
    const contacts = (await getSql()`SELECT id, name, email, subject, message, status, created_at, count(*) OVER() AS total_items FROM contact_messages WHERE (${status?.data ?? null}::contact_status IS NULL OR status = ${status?.data ?? null}::contact_status) AND (${query} = '' OR name ILIKE '%' || ${query} || '%' OR email ILIKE '%' || ${query} || '%' OR COALESCE(subject, '') ILIKE '%' || ${query} || '%') ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`) as ContactRow[];
    const totalItems = contacts.length ? Number(contacts[0].total_items) : 0;
    sendJson(res, 200, { items: contacts.map((contact) => ({ id: String(contact.id), name: contact.name, email: contact.email, subject: contact.subject, message: contact.message, status: contact.status, createdAt: contact.created_at })), page: { number: page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } });
  } catch (error) { sendError(res, error); }
}
