// Creates and removes a temporary account and session in the configured database.
import { randomBytes } from 'node:crypto';
import { getSql } from '../lib/db.js';
import { hashPassword } from '../lib/password.js';

const sql = getSql();
const suffix = randomBytes(10).toString('hex');
const username = `session_test_${suffix}`;
const password = randomBytes(24).toString('base64url');
let userId: string | undefined;
let skillId: string | undefined;
try {
  const passwordHash = await hashPassword(password);
  const rows = await sql`INSERT INTO users (username, email, password_hash) VALUES (${username}, ${`${username}@example.invalid`}, ${passwordHash}) RETURNING id`;
  userId = String(rows[0].id);
  await sql`INSERT INTO user_roles (user_id, role) VALUES (${userId}, 'editor')`;
  const origin = 'http://localhost:8081';
  const login = await fetch('http://localhost:3000/v1/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const loginBody = await login.json() as { user?: { id: string; roles: string[] } };
  if (login.status !== 200 || !cookie || loginBody.user?.id !== userId || !Array.isArray(loginBody.user.roles) || !loginBody.user.roles.includes('editor')) throw new Error(`Login failed: HTTP ${login.status}`);
  if (login.headers.get('access-control-allow-origin') !== origin || login.headers.get('access-control-allow-credentials') !== 'true') throw new Error('Login CORS check failed.');
  const headers = { Cookie: cookie, Origin: origin };
  const valid = await fetch('http://localhost:3000/v1/auth/session', { headers });
  if (valid.status !== 200 || (await valid.json() as { user?: { id: string } }).user?.id !== userId) throw new Error('Authenticated session check failed.');
  const protectedResponse = await fetch('http://localhost:3000/v1/admin/profile', { headers });
  if (protectedResponse.status !== 200) throw new Error(`Authenticated admin request failed: ${protectedResponse.status}`);
  const createSkill = await fetch('http://localhost:3000/v1/admin/skills', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'draft', group: 'tool', proficiency: null, translations: [{ locale: 'es-MX', name: username }, { locale: 'en-US', name: username }] }) });
  if (createSkill.status !== 201) throw new Error(`Skill creation without a rating failed: ${createSkill.status}`);
  skillId = (await createSkill.json() as { skill: { id: string } }).skill.id;
  const draftList = await fetch('http://localhost:3000/v1/public/skills?locale=es-MX');
  if ((await draftList.json() as { items: Array<{ id: string }> }).items.some(item => item.id === skillId)) throw new Error('Draft skill was visible publicly.');
  const clearRating = await fetch(`http://localhost:3000/v1/admin/skills/${skillId}`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ proficiency: null, iconUrl: '/img/skills/adaptabilidad.svg', developmentAreas: [{ slug: 'devops', es: 'DevOps', en: 'DevOps' }] }) });
  if (clearRating.status !== 200 || (await clearRating.json() as { skill: { proficiency: number | null } }).skill.proficiency !== null) throw new Error('Editing an unrated skill failed.');
  const skillDetail = await fetch(`http://localhost:3000/v1/admin/skills/${skillId}`, { headers });
  const details = await skillDetail.json() as { skill: { iconUrl: string | null; developmentAreas: Array<{ slug: string }> } };
  if (skillDetail.status !== 200 || details.skill.iconUrl !== '/img/skills/adaptabilidad.svg' || details.skill.developmentAreas[0]?.slug !== 'devops') throw new Error('Skill icon or development areas did not persist.');
  const logout = await fetch('http://localhost:3000/v1/auth/logout', { method: 'POST', headers });
  if (logout.status !== 204) throw new Error('Logout failed.');
  const revoked = await fetch('http://localhost:3000/v1/auth/session', { headers });
  if (revoked.status !== 200 || (await revoked.json() as { user: unknown }).user !== null) throw new Error('Logged-out session was not rejected.');
  const denied = await fetch('http://localhost:3000/v1/admin/profile', { headers });
  if (denied.status !== 401) throw new Error('Logged-out session could access admin data.');
  console.log('Login, cookie session, admin access, CORS, draft privacy, unrated skill and area/icon editing, logout and revocation: OK');
} finally {
  if (skillId) await sql`DELETE FROM skills WHERE id = ${skillId}`;
  if (userId) await sql`DELETE FROM users WHERE id = ${userId}`;
}
