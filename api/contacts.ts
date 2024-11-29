import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { user } = req.query as { user?: string };
	if (req.method === "GET") {
		try {
			const userResult =
				await sql`SELECT id FROM users WHERE username = ${user?.toLowerCase()}`;

			if (userResult.rows.length === 0) {
				return res.status(404).json({
					message: "User not found",
				});
			}

			const { id } = userResult.rows[0];

			const result = await sql`
				SELECT *
				FROM contacts 
				WHERE user_id = ${id};
			`;

			return res.status(200).json(result.rows);
		} catch (error) {
			return res.status(500).json({
				message: error.message || "Internal Server Error",
			});
		}
	} else if (req.method === "POST") {
		// Create a new contact
		const { name, email, message, developer } = JSON.parse(req.body);

		try {
			// Properly parameterize the query
			const result =
				await sql`SELECT id FROM users WHERE username = ${developer};`;

			const insertResult = await sql`
				INSERT INTO contacts (name, email, message, user_id)
				VALUES (${name}, ${email}, ${message}, ${result.rows[0].id})
				RETURNING id;
			`;

			return res
				.status(insertResult ? 200 : 400)
				.json(
					insertResult
						? { userId: result.rows[0].id }
						: { message: "No user found" }
				);
		} catch (error) {
			console.log("error", error);
			return res.status(500).json({
				message: error.message || "Internal Server Error",
			});
		}
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
