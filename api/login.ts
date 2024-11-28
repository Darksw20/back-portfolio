import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { username, password } = req.body as {
		username?: string;
		password?: string;
	};
	if (req.method === "GET") {
		// Process a POST request
		return res.json({
			message: `GET Hello !`,
		});
	} else if (req.method === "POST") {
		try {
			const query = `
                SELECT id, email
                FROM users 
                WHERE username = ${username} and password = ${password};
            `;
			const result = await sql`
                ${query}
            `;

			// return res.status(200).json(result.rows.length > 0 ? result.rows[0] : {});
			return res.status(200).json({
				result: result,
				query: query,
			});
		} catch (error) {
			return res.status(500).json({
				message: error.message || "Internal Server Error",
			});
		}
	} else {
		// Handle any other HTTP method
		return res.json({
			message: `Other Hello !`,
		});
	}
}
