import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSourceIpHash } from "../../../lib/contact.js";
import { getSql } from "../../../lib/db.js";
import {
  ApiError,
  enforceOrigin,
  handlePreflight,
  parseBody,
  requireMethod,
  sendError,
  sendJson,
} from "../../../lib/http.js";

const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().toLowerCase().email().max(320),
  subject: z.string().trim().max(255).optional(),
  message: z.string().trim().min(10).max(10_000),
  website: z.string().max(0).optional(),
});

type RecentSubmissionCount = { count: string | number };
type CreatedContact = { id: string | number };
const maximumSubmissionsPerHour = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res) || !enforceOrigin(req, res) || !requireMethod(req, res, "POST")) {
    return;
  }

  try {
    const input = parseBody(req, contactInputSchema);
    if (input.website) {
      // Treat bot submissions as successful so they cannot tune against the honeypot.
      sendJson(res, 202, { accepted: true });
      return;
    }

    const sourceIpHash = getSourceIpHash(req);
    const sql = getSql();
    if (sourceIpHash) {
      const recentSubmissions = (await sql`
        SELECT count(*) AS count
        FROM contact_messages
        WHERE source_ip_hash = ${sourceIpHash}
          AND created_at > now() - interval '1 hour'
      `) as RecentSubmissionCount[];
      if (Number(recentSubmissions[0]?.count ?? 0) >= maximumSubmissionsPerHour) {
        throw new ApiError(429, "rate_limited", "Please wait before submitting another message.");
      }
    }

    const contacts = (await sql`
      WITH inserted_contact AS (
        INSERT INTO contact_messages (name, email, subject, message, source_ip_hash)
        VALUES (${input.name}, ${input.email}, ${input.subject ?? null}, ${input.message}, ${sourceIpHash})
        RETURNING id
      )
      INSERT INTO contact_events (contact_message_id, event_type)
      SELECT id, 'submitted' FROM inserted_contact
      RETURNING contact_message_id AS id
    `) as CreatedContact[];
    const contact = contacts[0];
    if (!contact) {
      throw new ApiError(500, "contact_submission_failed", "Unable to submit the message.");
    }

    sendJson(res, 202, { accepted: true, id: String(contact.id) });
  } catch (error) {
    sendError(res, error);
  }
}
