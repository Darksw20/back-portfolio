import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { user } = req.query as { user?: string };
	if (req.method === "GET") {
		try {
			const query = user
				? `SELECT id,email,username,summary,motivation,github,linkedin FROM users WHERE username='${user}';`
				: `SELECT id,email,username,summary,motivation,github,linkedin FROM users;`;
			const result = await sql`${query}`;
			return res.status(200).json(result.rows);
		} catch (error) {
			return res.status(500).json({
				message: error,
			});
		}
	} else if (req.method === "POST") {
		// Process a POST request
		return res.json({
			message: `POST Hello ${name}!`,
		});
	} else {
		// Handle any other HTTP method
		return res.json({
			message: `Other Hello ${name}!`,
		});
	}
}
