import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { user } = req.query as { user?: string };
	if (req.method === "GET") {
		try {
			const result = await sql`
				SELECT s.*,a.*,s.type as skill_type,a.type as achivement_type
					FROM users u
					INNER JOIN public.achievements a on u.id = a.user_id
					INNER JOIN public.skill_achievements sa on a.id = sa.fk_achievement
					INNER JOIN public.skills s on s.id = sa.fk_skill
					WHERE username=${user};`;

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
