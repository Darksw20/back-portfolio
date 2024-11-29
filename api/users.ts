import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { user } = req.query as { user?: string };
	if (req.method === "GET") {
		try {
			let result;
			if (user) {
				// Use parameterized query to prevent SQL injection
				result = await sql`
					SELECT id, email, username, summary, motivation, github, linkedin 
					FROM users 
					WHERE username = ${user?.toLowerCase()};
				`;
			} else {
				result = await sql`
					SELECT id, email, username, summary, motivation, github, linkedin 
					FROM users;
				`;
			}
			return res.status(200).json(result.rows);
		} catch (error) {
			return res.status(500).json({
				message: error.message || "Internal Server Error",
			});
		}
	} else if (req.method === "POST") {
		// Process a POST request
		return res.json({
			message: `POST Hello ${name}!`,
		});
	} else if (req.method === "PATCH") {
		// Process a PATCH request
		return res.json({
			message: `PATCH Hello ${name}!`,
		});
	} else if (req.method === "DELETE") {
		// Process a DELETE request
		return res.json({
			message: `DELETE Hello ${name}!`,
		});
	} else {
		// Handle any other HTTP method
		return res.json({
			message: `Other Hello ${name}!`,
		});
	}
}
