import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// Set CORS headers
	res.setHeader("Access-Control-Allow-Credentials", "false");
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET,OPTIONS,PATCH,DELETE,POST,PUT"
	);
	res.setHeader(
		"Access-Control-Allow-Headers",
		"Authorization,X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
	);

	const { username, password } = JSON.parse(req.body);

	if (req.method === "GET") {
		// Handle GET requests
		return res.json({
			message: `GET Hello!`,
		});
	} else if (req.method === "POST") {
		try {
			// Properly parameterize the query
			const result =
				await sql`SELECT id,email FROM users WHERE username = ${username} AND password = ${password};`;

			console.log(
				"result",
				`SELECT id,email FROM users WHERE username = ${username} AND password = ${password};`,
				result
			);

			const userFound = result.rows.length > 0;

			return res
				.status(userFound ? 200 : 400)
				.json(userFound ? result.rows[0] : { message: "No user found" });
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
