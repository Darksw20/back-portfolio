import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const output = resolve(process.argv[2] || '.vercel/output');
async function files(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
const staticFiles = (await files(join(output, 'static'))).map(path => relative(join(output, 'static'), path));
if (staticFiles.some(path => path !== 'robots.txt')) throw new Error(`Unexpected public assets: ${staticFiles.join(', ')}`);
const routerConfig = JSON.parse(await readFile(join(output, 'functions/api/router.func/.vc-config.json'), 'utf8'));
if (!routerConfig.handler) throw new Error('API router function is missing a handler');
const config = JSON.parse(await readFile(join(output, 'config.json'), 'utf8'));
if (!config.routes?.some(route => route.dest?.includes('/api/router?__portfolio_route='))) throw new Error('API router rewrite is missing');
console.log(`Verified static assets: ${staticFiles.join(', ') || '(none)'}; API router and rewrite present.`);
