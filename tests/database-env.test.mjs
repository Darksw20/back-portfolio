import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabaseUrl } from '../lib/env.ts';

test('uses the Neon integration URL when DATABASE_URL is absent', () => {
  const previous = { ...process.env };
  try {
    delete process.env.DATABASE_URL;
    process.env.PORTFOLIO_DATABASE_URL_UNPOOLED = 'postgresql://user:password@example.com/neon';
    assert.equal(getDatabaseUrl(), process.env.PORTFOLIO_DATABASE_URL_UNPOOLED);
    process.env.DATABASE_URL = 'postgresql://user:password@example.com/local';
    assert.equal(getDatabaseUrl(), process.env.DATABASE_URL);
    delete process.env.DATABASE_URL;
    delete process.env.PORTFOLIO_DATABASE_URL_UNPOOLED;
    assert.throws(() => getDatabaseUrl());
  } finally {
    process.env = previous;
  }
});
