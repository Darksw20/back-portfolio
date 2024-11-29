import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { user } = req.query as { user?: string };
	if (req.method === "GET") {
		if (!user) {
			try {
				const result = await sql`
					SELECT * FROM roles;`;
				return res.status(200).json(result.rows);
			} catch (error) {
				return res.status(500).json({
					message: error,
				});
			}
		}
		try {
			const result = await sql`SELECT a.*,r.*
                FROM users u
                INNER JOIN public.achievements a on u.id = a.user_id
                INNER JOIN public.roles_achievements ra on a.id = ra.fk_achievement
                INNER JOIN public.roles r on r.id = ra.fk_role
                WHERE u.username=${user?.toLowerCase()};`;
			return res.status(200).json(result.rows);
		} catch (error) {
			return res.status(500).json({
				message: error,
			});
		}
	} else if (req.method === "POST") {
		//Add new role
		const insertRole = await sql`
			INSERT INTO roles (name, percent, image)
			VALUES (${req.body.name}, ${req.body.percent}, ${req.body.image})
			RETURNING *;`;
		return res.status(200).json(insertRole.rows[0]);
	} else {
		// Handle any other HTTP method
		return res.json({
			message: `Other Hello ${name}!`,
		});
	}
}
