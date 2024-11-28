import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// Set CORS headers
	res.setHeader("Access-Control-Allow-Credentials", "true");
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET,OPTIONS,PATCH,DELETE,POST,PUT"
	);
	res.setHeader(
		"Access-Control-Allow-Headers",
		"Authorization,X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
	);

	if (req.method === "GET") {
		// Handle GET requests
		return res.json({
			message: `GET Hello!`,
		});
	} else if (req.method === "POST") {
		// Parse JSON body
		let body;
		try {
			body = JSON.parse(req.body || "{}");
		} catch (error) {
			return res.status(400).json({ message: "Invalid JSON body" });
		}

		const { username, email, password } = body;

		if (!username || !email || !password) {
			return res.status(400).json({ message: "Missing required fields" });
		}

		try {
			const result = await sql`
				 INSERT INTO users (username, email, password)
				 VALUES (${username}, ${email}, ${password})
				 RETURNING id;
			 `;

			return res.status(201).json({ userId: result.rows[0].id });
		} catch (error) {
			console.error("Database error:", error);
			return res.status(500).json({ message: "Internal Server Error" });
		}
	} else {
		// Handle any other HTTP method
		return res.json({
			message: `Other Hello!`,
		});
	}
}
