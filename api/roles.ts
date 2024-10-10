import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { user } = req.query as { user?: string };
	if (req.method === "GET") {
		try {
			const result = await sql`SELECT a.*,r.*
                FROM users u
                INNER JOIN public.achievements a on u.id = a.user_id
                INNER JOIN public.roles_achievements ra on a.id = ra.fk_achievement
                INNER JOIN public.roles r on r.id = ra.fk_role
                WHERE u.username=${user};`;
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
