import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { user } = req.query as { user?: string };
	if (req.method === "GET") {
		if (!user) {
			try {
				const result = await sql`
					SELECT * FROM skills;`;
				return res.status(200).json(result.rows);
			} catch (error) {
				return res.status(500).json({
					message: error,
				});
			}
		}
		try {
			const result = await sql`
				SELECT s.*,a.*,s.type as skill_type,a.type as achivement_type
					FROM users u
					INNER JOIN public.achievements a on u.id = a.user_id
					INNER JOIN public.skill_achievements sa on a.id = sa.fk_achievement
					INNER JOIN public.skills s on s.id = sa.fk_skill
					WHERE username=${user?.toLowerCase()};`;

			// Helper function to get unique values by 'name'
			const getUniqueByName = (rows, type) => {
				const seen = new Set();
				return rows.filter((row) => {
					if (row.skill_type === type && !seen.has(row.name)) {
						seen.add(row.name); // Add the 'name' to the set
						return true; // Keep this row
					}
					return false; // Skip duplicates
				});
			};

			const softSkill = getUniqueByName(result.rows, "SOFT_SKILL");
			const courses = getUniqueByName(result.rows, "COURSE");
			const languages = getUniqueByName(result.rows, "LANGUAGE");
			const programmingLanguages = getUniqueByName(
				result.rows,
				"PROGRAMMING_LANG"
			);
			const tools = getUniqueByName(result.rows, "TOOLS");
			return res.status(200).json({
				softSkill,
				courses,
				languages,
				programmingLanguages,
				tools,
			});
		} catch (error) {
			return res.status(500).json({
				message: error,
			});
		}
	} else if (req.method === "POST") {
		// Add new skill
		const insertSkill = await sql`
			INSERT INTO skills (name, type, percent, image)
			VALUES (${req.body.name}, ${req.body.type}, ${req.body.percent}, 'cuervo.png')
			RETURNING id;`;

		return res.json({
			message: `POST Hello ${insertSkill.rows[0].id}!`,
		});
	} else if (req.method === "PUT") {
		// get dynamic skills data
		const { user, editedFields } = req.body;

		// get user id
		const responseUser = await sql`
			SELECT id
			FROM users
			WHERE username = ${user.toLowerCase()};`;

		const userId = responseUser.rows[0].id;

		editedFields.forEach(async (field) => {
			const { id, name, type, percent } = field;
			const result = await sql`
				UPDATE skills
				SET name = ${name}, type = ${type}, percent = ${percent}, image = 'cuervo.png'
				WHERE id = ${id};`;
			console.log(result);
		});

		return res.json({
			message: `PUT Hello ${userId}!`,
		});
	} else {
		// Handle any other HTTP method
		return res.json({
			message: `Other Hello ${name}!`,
		});
	}
}
