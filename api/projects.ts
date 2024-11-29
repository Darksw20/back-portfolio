import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { user } = req.query as { user?: string };
	if (req.method === "GET") {
		try {
			const result = await sql`SELECT a.*
				FROM users
				INNER JOIN achievements a on users.id = a.user_id
				WHERE users.username=${user?.toLowerCase()};`;
			return res.status(200).json(result.rows);
		} catch (error) {
			return res.status(500).json({
				message: error,
			});
		}
	} else if (req.method === "POST") {
		// add new achievement
		const insertAchievement = await sql`
			INSERT INTO achievements (title, description, place, url,start_date, end_date,type,user_id)
			VALUES (${req.body.title}, ${req.body.description}, ${req.body.place}, ${req.body.url},${req.body.start_date},${req.body.end_date},${req.body.type},${req.body.user_id})
			RETURNING *;`;
		return res.status(200).json(insertAchievement.rows[0]);
	} else {
		// Handle any other HTTP method
		return res.json({
			message: `Other Hello ${name}!`,
		});
	}
}
