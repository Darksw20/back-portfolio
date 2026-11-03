import test from 'node:test';
import assert from 'node:assert/strict';
import route from '../api/router.ts';

async function call(url, query = {}, method = 'GET', headers = {}) {
  const req = { url, query, method, headers };
  const res = { statusCode: 200, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
  await route(req, res);
  return { req, res };
}
test('local and Vercel rewritten requests reach the same session handler', async () => {
  for (const [url,query] of [['/v1/auth/session',{}], ['/api/v1/auth/session',{__portfolio_route:'auth/session'}]]) {
    const {res} = await call(url,query);
    assert.equal(res.statusCode,200);
    assert.deepEqual(res.body,{user:null});
  }
});
test('dynamic route parameters override query values and reach the proper handler', async () => {
  const {req,res} = await call('/api/v1/public/projects/bad%20slug',{__portfolio_route:'public/projects/bad%20slug',slug:'other',locale:'en-US'});
  assert.equal(req.query.slug,'bad slug');
  assert.equal(req.query.locale,'en-US');
  assert.equal(res.statusCode,400);
  assert.equal(res.body.error.code,'invalid_slug');
});
test('admin routes remain protected and unknown paths return 404', async () => {
  assert.equal((await call('/api/v1/admin/skills',{__portfolio_route:'admin/skills'})).res.statusCode,401);
  assert.equal((await call('/api/v1/missing',{__portfolio_route:'missing'})).res.statusCode,404);
});
test('preflight continues to enforce origin and preserve CORS headers', async () => {
  process.env.ALLOWED_ORIGINS='http://localhost:8080';
  const {res} = await call('/api/v1/public/skills',{__portfolio_route:'public/skills'},'OPTIONS',{origin:'http://localhost:8080'});
  assert.equal(res.statusCode,204);
  assert.equal(res.headers['Access-Control-Allow-Origin'],'http://localhost:8080');
});
test('resume routes require an authenticated session', async () => {
  for (const path of ['admin/resumes','admin/resumes/source','admin/resumes/123']) {
    const {res} = await call(`/api/v1/${path}`,{__portfolio_route:path});
    assert.equal(res.statusCode,401,path);
  }
});
