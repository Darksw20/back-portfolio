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

	if (!req.body.username || !req.body.email || !req.body.password) {
		return res.status(400).json({ message: "Missing required fields" });
	}

	const { username, email, password } = req.body;

	console.log("username", username);
	console.log("email", email);
	console.log("password", password);

	if (req.method === "GET") {
		// Handle GET requests
		return res.json({
			message: `GET Hello!`,
		});
	} else if (req.method === "POST") {
		try {
			// Validate if the user already exists
			const user = await sql`
				SELECT id FROM users WHERE username = ${username};
			`;

			if (user.rows.length > 0) {
				return res.status(400).json({ message: "Username already exists" });
			}

			// validate if the email already exists
			const userEmail = await sql`
				SELECT id FROM users WHERE email = ${email};
			`;

			if (userEmail.rows.length > 0) {
				return res.status(400).json({ message: "Email already exists" });
			}

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
