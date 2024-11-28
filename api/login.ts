import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	console.log("req.method", req.method);
	console.log("req.body", req.body);
	console.log("req.query", req.query);
	console.log("req.headers", req.headers);
	console.log("req.cookies", req.cookies);

	const { username, password } = req.body as {
		username?: string;
		password?: string;
	};

	if (req.method === "GET") {
		// Handle GET requests
		return res.json({
			message: `GET Hello!`,
		});
	} else if (req.method === "POST") {
		try {
			// Properly parameterize the query
			const result = await sql`
				SELECT id, email 
				FROM users 
				WHERE username = ${username} AND password = ${password};
			`;

			console.log("result", result);

			return res
				.status(200)
				.json(
					result.rows.length > 0 ? result.rows[0] : { message: "No user found" }
				);
		} catch (error) {
			console.log("error", error);
			return res.status(500).json({
				message: error.message || "Internal Server Error",
			});
		}
	} else {
		// Handle any other HTTP method
		return res.json({
			message: `Other Hello!`,
		});
	}
}
