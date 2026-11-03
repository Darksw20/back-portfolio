import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import { getDatabaseUrl } from '../lib/env.js';
import { profile, projects, learning, skills, workHistory } from '../seed/portfolio.js';
import { experiences } from '../seed/experience.js';
import { seedMedia } from '../seed/media.js';

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--apply')) throw new Error('Usage: npm run seed -- [--apply]');
const databaseUrl = getDatabaseUrl();
const apply = args.includes('--apply');
neonConfig.webSocketConstructor = WebSocket;
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
const totals = { profileTranslations: 0, workHistory: 0, socialLinks: 0, projects: 0, projectAreas: 0, learning: 0, skills: 0, skillsPublished: 0, skillDescriptions: 0, skillAreas: 0, skillIcons: 0, experiences: 0, currentExperiences: 0, projectSkillLinks: 0 };
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('portfolio-seed-v1'))");
  const existingProfiles = await client.query('SELECT id FROM profiles ORDER BY id LIMIT 2');
  if (existingProfiles.rowCount !== 1) throw new Error('Exactly one profile is required. Create the initial administrator first; multiple profiles need manual review.');
  const profileId = existingProfiles.rows[0].id;
  await client.query('CREATE TABLE IF NOT EXISTS portfolio_seed_records (seed_key text PRIMARY KEY, entity_type text NOT NULL, entity_id bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');
  for (const t of profile.translations) {
    const result = await client.query('INSERT INTO profile_translations (profile_id, locale, display_name, headline, biography) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (profile_id, locale) DO NOTHING', [profileId,t.locale,t.displayName,t.headline,t.biography]); totals.profileTranslations += result.rowCount ?? 0;
  }
  for (let i = 0; i < profile.socialLinks.length; i++) {
    const link = profile.socialLinks[i];
    const result = await client.query('INSERT INTO social_links (profile_id, platform, url, display_order) VALUES ($1,$2,$3,$4) ON CONFLICT (profile_id, platform) DO NOTHING', [profileId,link.platform,link.url,i]); totals.socialLinks += result.rowCount ?? 0;
  }
  async function alreadySeeded(key: string) { return (await client.query('SELECT 1 FROM portfolio_seed_records WHERE seed_key = $1', [key])).rowCount !== 0; }
  async function remember(key: string, type: string, id: string) { await client.query('INSERT INTO portfolio_seed_records(seed_key, entity_type, entity_id) VALUES ($1,$2,$3)', [key,type,id]); }
  for (const project of projects) {
    const key = `project:${project.key}`; if (await alreadySeeded(key)) continue;
    const found = await client.query('SELECT project_id FROM project_translations WHERE slug = $1 LIMIT 1', [project.key]);
    if (found.rows[0]) { await remember(key,'project',found.rows[0].project_id); continue; }
    const cover = project.key === 'huaro' ? seedMedia['/img/Huaro.JPG'] : null;
    const gallery = project.key === 'huaro' ? [seedMedia['/img/HuaroM.png']] : [];
    const inserted = await client.query("INSERT INTO projects (status, published_at, cover_image_url, gallery_image_urls) VALUES ('published', now(), $1, $2::jsonb) RETURNING id", [cover, JSON.stringify(gallery)]); const id = inserted.rows[0].id;
    for (const [locale, data] of [['es-MX', project.es], ['en-US', project.en]] as const) await client.query('INSERT INTO project_translations (project_id, locale, slug, title, summary, description) VALUES ($1,$2,$3,$4,$5,$6)', [id,locale,project.key,...data]);
    for (const name of project.tags) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await client.query('INSERT INTO tags (slug, name) VALUES ($1,$2) ON CONFLICT (slug) DO NOTHING', [slug,name]);
      const tag = await client.query('SELECT id FROM tags WHERE slug = $1', [slug]);
      await client.query('INSERT INTO project_tags (project_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id,tag.rows[0].id]);
    }
    await remember(key,'project',id); totals.projects++;
  }
  // Classify only the original seeded projects, once, without replacing owner-entered areas.
  const initialAreas: Record<string, Array<{slug: string; es: string; en: string}>> = {
    huaro: [{slug: 'desarrollo-web', es: 'Desarrollo web', en: 'Web development'}, {slug: 'desarrollo-movil', es: 'Desarrollo móvil', en: 'Mobile development'}],
    'cicd-toshiba': [{slug: 'devops', es: 'DevOps', en: 'DevOps'}],
    'cloud-delivery-blackbull': [{slug: 'devops', es: 'DevOps', en: 'DevOps'}, {slug: 'desarrollo-backend', es: 'Desarrollo backend', en: 'Backend development'}],
    'talent-land-camping': [{slug: 'desarrollo-web', es: 'Desarrollo web', en: 'Web development'}],
    'freelance-educational-server': [{slug: 'desarrollo-web', es: 'Desarrollo web', en: 'Web development'}],
  };
  for (const [projectKey, areas] of Object.entries(initialAreas)) {
    const seedKey = `project-areas:${projectKey}`;
    if (await alreadySeeded(seedKey)) continue;
    const seeded = await client.query("SELECT entity_id FROM portfolio_seed_records WHERE seed_key = $1 AND entity_type = 'project'", [`project:${projectKey}`]);
    if (!seeded.rows[0]) continue;
    const id = seeded.rows[0].entity_id;
    const updated = await client.query("UPDATE projects SET development_areas = $2::jsonb WHERE id = $1 AND development_areas = '[]'::jsonb", [id, JSON.stringify(areas)]);
    totals.projectAreas += updated.rowCount ?? 0;
    await remember(seedKey, 'project-areas', id);
  }
  for (const [locale, text] of Object.entries(workHistory)) {
    const key = `profile-work-history:${profileId}:${locale}`;
    if (await alreadySeeded(key)) continue;
    const updated = await client.query("UPDATE profile_translations SET work_history = $3 WHERE profile_id = $1 AND locale = $2 AND work_history = ''", [profileId, locale, text]);
    totals.workHistory += updated.rowCount ?? 0;
    await remember(key, 'profile', profileId);
  }
  for (const entry of learning) {
    const key = `learning:${entry.key}`; if (await alreadySeeded(key)) continue;
    const found = await client.query('SELECT l.id FROM learning_entries l JOIN learning_translations t ON t.learning_entry_id = l.id WHERE l.provider = $1 AND t.locale = $2 AND t.title = $3 LIMIT 1', [entry.provider,'es-MX',entry.es[0]]);
    if (found.rows[0]) { await remember(key,'learning',found.rows[0].id); continue; }
    const result = await client.query("INSERT INTO learning_entries (status, type, provider, published_at) VALUES ('published',$1::learning_type,$2,now()) RETURNING id", [entry.type, entry.provider]); const id = result.rows[0].id;
    for (const [locale, data] of [['es-MX', entry.es], ['en-US', entry.en]] as const) await client.query('INSERT INTO learning_translations (learning_entry_id, locale, title, description) VALUES ($1,$2,$3,$4)', [id,locale,...data]);
    await remember(key,'learning',id); totals.learning++;
  }
  for (const [key, group, es, en] of skills) {
    const seedKey = `skill:${key}`;
    if (await alreadySeeded(seedKey)) {
      const publishKey = `publish-seeded-skill:${key}`;
      if (!await alreadySeeded(publishKey)) {
        const record = await client.query("SELECT entity_id FROM portfolio_seed_records WHERE seed_key = $1 AND entity_type = 'skill'", [seedKey]);
        if (record.rows[0]) {
          const updated = await client.query("UPDATE skills SET proficiency = NULL, status = 'published', published_at = now() WHERE id = $1 AND status = 'draft' AND proficiency = 0 AND updated_at = created_at", [record.rows[0].entity_id]);
          totals.skillsPublished += updated.rowCount ?? 0;
          await remember(publishKey, 'skill', record.rows[0].entity_id);
        }
      }
      continue;
    }
    const found = await client.query('SELECT s.id FROM skills s JOIN skill_translations t ON t.skill_id = s.id WHERE s.group_name = $1 AND t.locale = $2 AND lower(t.name) = lower($3) LIMIT 1', [group,'es-MX',es]);
    if (found.rows[0]) { await remember(seedKey,'skill',found.rows[0].id); continue; }
    // An unset proficiency is distinct from a zero rating.
    const result = await client.query("INSERT INTO skills (status, group_name, proficiency, published_at) VALUES ('published',$1,NULL,now()) RETURNING id", [group]); const id = result.rows[0].id;
    for (const [locale, name] of [['es-MX',es],['en-US',en]]) await client.query('INSERT INTO skill_translations (skill_id, locale, name) VALUES ($1,$2,$3)', [id,locale,name]);
    await remember(seedKey,'skill',id); totals.skills++;
  }
  const skillIcons: Record<string, string> = {
    'team-building': seedMedia['/img/Dise%C3%B1os-16.png'], leadership: seedMedia['/img/Dise%C3%B1os-17.png'], 'problem-solving': seedMedia['/img/Dise%C3%B1os-18.png'], 'critical-thinking': seedMedia['/img/Dise%C3%B1os-19.png'],
    adaptability: seedMedia['/img/skills/adaptabilidad.svg'], friendliness: seedMedia['/img/skills/amabilidad.svg'], 'continuous-learning': seedMedia['/img/skills/aprendizaje.svg'], innovation: seedMedia['/img/skills/innovacion.svg'],
  };
  for (const [skillKey, icon] of Object.entries(skillIcons)) {
    const marker = `skill-icon:${skillKey}`; if (await alreadySeeded(marker)) continue;
    const record = await client.query("SELECT entity_id FROM portfolio_seed_records WHERE seed_key = $1 AND entity_type = 'skill'", [`skill:${skillKey}`]);
    if (!record.rows[0]) continue;
    const updated = await client.query('UPDATE skills SET icon_url = $2 WHERE id = $1 AND icon_url IS NULL', [record.rows[0].entity_id, icon]);
    totals.skillIcons += updated.rowCount ?? 0;
    await remember(marker, 'skill', record.rows[0].entity_id);
  }
  const categories = [
    { slug: 'devops', es: 'DevOps', en: 'DevOps', skills: ['python','shell','groovy','docker','aws','azure','jenkins','maven','git','gitlab','bitbucket','nexus'] },
    { slug: 'backend', es: 'Backend', en: 'Backend', skills: ['python','java','php','javascript-typescript','nodejs','laravel','postgresql','mongodb','aws','azure','git'] },
    { slug: 'frontend', es: 'Frontend', en: 'Frontend', skills: ['javascript-typescript','angular','react','vue','git'] },
    { slug: 'videojuegos', es: 'Videojuegos', en: 'Game development', skills: ['csharp','unity'] },
    { slug: 'movil', es: 'Desarrollo móvil', en: 'Mobile development', skills: ['java','kotlin','android'] },
  ];
  const skillKeys = new Set(categories.flatMap(category => category.skills));
  for (const skillKey of skillKeys) {
    const marker = `skill-areas:${skillKey}`; if (await alreadySeeded(marker)) continue;
    const record = await client.query("SELECT entity_id FROM portfolio_seed_records WHERE seed_key = $1 AND entity_type = 'skill'", [`skill:${skillKey}`]);
    if (!record.rows[0]) continue;
    const areas = categories.filter(category => category.skills.includes(skillKey)).map(({slug, es, en}) => ({slug, es, en}));
    const updated = await client.query("UPDATE skills SET development_areas = $2::jsonb WHERE id = $1 AND development_areas = '[]'::jsonb", [record.rows[0].entity_id, JSON.stringify(areas)]);
    totals.skillAreas += updated.rowCount ?? 0;
    await remember(marker, 'skill', record.rows[0].entity_id);
  }
  const languageDescriptions: Record<string, Record<string, string>> = {
    python: { 'es-MX': '3 años de experiencia', 'en-US': '3 years of experience' },
    java: { 'es-MX': '2 años de experiencia en Android / Java', 'en-US': '2 years of Android / Java experience' },
    shell: { 'es-MX': '1 año de experiencia', 'en-US': '1 year of experience' },
    groovy: { 'es-MX': '1 año de experiencia', 'en-US': '1 year of experience' },
    php: { 'es-MX': '4 años de experiencia', 'en-US': '4 years of experience' },
    'javascript-typescript': { 'es-MX': '3 años en frontend y 4 años en backend', 'en-US': '3 years in frontend and 4 years in backend' },
    maven: { 'es-MX': '1 año de experiencia', 'en-US': '1 year of experience' },
    docker: { 'es-MX': '2 años de experiencia', 'en-US': '2 years of experience' },
    aws: { 'es-MX': '3 años de experiencia', 'en-US': '3 years of experience' },
    azure: { 'es-MX': '2 años de experiencia', 'en-US': '2 years of experience' },
    laravel: { 'es-MX': '2 años de experiencia', 'en-US': '2 years of experience' },
    spanish: { 'es-MX': 'Nativo', 'en-US': 'Native' },
    english: { 'es-MX': 'Conversacional', 'en-US': 'Conversational' },
    japanese: { 'es-MX': 'Principiante', 'en-US': 'Beginner' },
  };
  for (const [key, translations] of Object.entries(languageDescriptions)) {
    const marker = `skill-descriptions:${key}`;
    if (await alreadySeeded(marker)) continue;
    const record = await client.query("SELECT entity_id FROM portfolio_seed_records WHERE seed_key = $1 AND entity_type = 'skill'", [`skill:${key}`]);
    if (!record.rows[0]) continue;
    for (const [locale, description] of Object.entries(translations)) {
      const updated = await client.query('UPDATE skill_translations SET description = $3 WHERE skill_id = $1 AND locale = $2 AND description IS NULL', [record.rows[0].entity_id, locale, description]);
      totals.skillDescriptions += updated.rowCount ?? 0;
    }
    await remember(marker, 'skill', record.rows[0].entity_id);
  }
  for (const entry of experiences) {
    const key = `experience:${entry.slug}`;
    if (await alreadySeeded(key)) continue;
    const existing = await client.query('SELECT id FROM experiences WHERE slug=$1', [entry.slug]);
    if (existing.rows[0]) { await remember(key,'experience',existing.rows[0].id); continue; }
    const created = await client.query("INSERT INTO experiences(slug,company,start_month,end_month,is_current,status,development_areas,published_at) VALUES ($1,$2,$3,$4,$5,'published',$6::jsonb,now()) RETURNING id", [entry.slug,entry.company,entry.startMonth,entry.endMonth,entry.isCurrent,JSON.stringify(entry.areas)]);
    const id=created.rows[0].id;
    for (const [locale,t] of [['es-MX',entry.es],['en-US',entry.en]] as const) await client.query('INSERT INTO experience_translations(experience_id,locale,title,summary,description) VALUES ($1,$2,$3,$4,$5)', [id,locale,t.title,t.summary,t.description]);
    for (const skillKey of entry.skills) await client.query("INSERT INTO experience_skills(experience_id,skill_id) SELECT $1,entity_id FROM portfolio_seed_records WHERE seed_key=$2 AND entity_type='skill' ON CONFLICT DO NOTHING", [id,`skill:${skillKey}`]);
    await remember(key,'experience',id);totals.experiences++;
  }
  const currentMarker = 'experience-current:toshiba-devops';
  if (!await alreadySeeded(currentMarker)) {
    const record = await client.query("SELECT entity_id FROM portfolio_seed_records WHERE seed_key='experience:toshiba-devops' AND entity_type='experience'");
    if (record.rows[0]) { const result = await client.query("UPDATE experiences SET is_current=true WHERE id=$1 AND end_month IS NULL AND is_current=false AND updated_at=created_at", [record.rows[0].entity_id]); totals.currentExperiences += result.rowCount ?? 0; await remember(currentMarker,'experience',record.rows[0].entity_id); }
  }
  const projectSkills: Record<string,string[]> = {
    huaro:['android'], 'cicd-toshiba':['jenkins','maven','java','shell','docker'],
    'cloud-delivery-blackbull':['aws','docker','python','php','laravel','bitbucket'],
    'talent-land-camping':['nodejs','vue','mongodb'], 'freelance-educational-server':['moodle','angular'],
  };
  for (const [projectKey,keys] of Object.entries(projectSkills)) {
    const marker=`project-skills:${projectKey}`;if(await alreadySeeded(marker))continue;
    const record=await client.query("SELECT entity_id FROM portfolio_seed_records WHERE seed_key=$1 AND entity_type='project'",[`project:${projectKey}`]);if(!record.rows[0])continue;
    const id=record.rows[0].entity_id;const existing=await client.query('SELECT 1 FROM project_skills WHERE project_id=$1 LIMIT 1',[id]);
    if(!existing.rows.length)for(const skillKey of keys){const result=await client.query("INSERT INTO project_skills(project_id,skill_id) SELECT $1,entity_id FROM portfolio_seed_records WHERE seed_key=$2 AND entity_type='skill' ON CONFLICT DO NOTHING",[id,`skill:${skillKey}`]);totals.projectSkillLinks+=result.rowCount??0;}
    await remember(marker,'project',id);
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(`${apply ? 'Applied' : 'Preview (rolled back)'}: ${JSON.stringify(totals)}. Skills with no owner rating are displayed without a score.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error('Seed failed:', error instanceof Error ? error.message : error); process.exitCode = 1;
} finally { client.release(); await pool.end(); }
