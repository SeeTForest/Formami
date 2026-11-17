// Synthetic local verification only. No .env or production credentials are read.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import bcrypt from 'bcryptjs';

const base = 'http://127.0.0.1:3035';
const container = 'forami-local-database-1';
assert.equal(
  execFileSync('docker', ['port', container, '5432'], { encoding: 'utf8' }).trim(),
  '127.0.0.1:55435',
);
const sql = statement =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'forami',
      '-d',
      'forami',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { input: statement, encoding: 'utf8' },
  );
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const ids = Array.from({ length: 8 }, () => randomUUID());
const [owner, other, website, foreign, team, teamWebsite, membership, session] = ids;
const username = `agent-check-${randomUUID().slice(0, 8)}`;
const password = randomUUID();
const range = `startAt=${Date.now() - 3600000}&endAt=${Date.now() + 60000}&timezone=UTC`;
const own = `/api/websites/${website}`;
let passed = 0;
let browser;
async function request(path, token, status = 200, method = 'GET', data) {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      'content-type': 'application/json',
    },
    ...(data !== undefined && { body: JSON.stringify(data) }),
  });
  assert.equal(response.status, status, `${method} ${path.split('?')[0]} status`);
  passed++;
  return response.json();
}
try {
  sql(`BEGIN;
    INSERT INTO "user"(user_id,username,password,role) VALUES
      (${quote(owner)},${quote(username)},${quote(bcrypt.hashSync(password, 10))},'user'),
      (${quote(other)},${quote(`${username}-other`)},${quote(bcrypt.hashSync(randomUUID(), 10))},'user');
    INSERT INTO team(team_id,name) VALUES (${quote(team)},'Agent synthetic team');
    INSERT INTO team_user(team_user_id,team_id,user_id,role) VALUES (${quote(membership)},${quote(team)},${quote(owner)},'team-member');
    INSERT INTO website(website_id,name,domain,user_id,team_id,created_by) VALUES
      (${quote(website)},'Agent synthetic own','example.com',${quote(owner)},NULL,${quote(owner)}),
      (${quote(foreign)},'Agent synthetic foreign','example.org',${quote(other)},NULL,${quote(other)}),
      (${quote(teamWebsite)},'Agent synthetic team','example.net',NULL,${quote(team)},${quote(owner)});
    INSERT INTO session(session_id,website_id,browser,os,device) VALUES (${quote(session)},${quote(website)},'chrome','Windows 10','desktop');
    INSERT INTO website_event(event_id,website_id,session_id,visit_id,url_path,hostname,event_type,event_name) VALUES
      (${quote(randomUUID())},${quote(website)},${quote(session)},${quote(session)},'/guide','example.com',1,NULL),
      (${quote(randomUUID())},${quote(website)},${quote(session)},${quote(session)},'/guide','example.com',2,'feature_used');
    COMMIT;`);
  const { token: login } = await request('/api/auth/login', null, 200, 'POST', {
    username,
    password,
  });
  const key = await request('/api/me/api-keys', login, 200, 'POST', {
    name: 'local-agent-verification',
  });
  assert.match(key.key, /^formami_/);
  const second = await request('/api/me/api-keys', login, 200, 'POST', { name: 'independent-key' });
  const keys = await request('/api/me/api-keys', login);
  assert(!JSON.stringify(keys).includes(key.key));
  const identity = await request('/api/me', key.key);
  assert.equal(identity.authType, 'api-key');
  assert.equal(identity.user.id, owner);
  const websites = await request('/api/websites?includeTeams=true&page=1&pageSize=100', key.key);
  assert.deepEqual(new Set(websites.data.map(row => row.id)), new Set([website, teamWebsite]));
  const stats = await request(`${own}/stats?${range}`, key.key);
  assert.equal(stats.pageviews, 1);
  assert.equal(stats.visitors, 1);
  assert.deepEqual(await request(`${own}/metrics?${range}&type=path`, key.key), [
    { x: '/guide', y: 1 },
  ]);
  assert.deepEqual(await request(`${own}/metrics?${range}&type=event`, key.key), [
    { x: 'feature_used', y: 1 },
  ]);
  await request(`${own}/pageviews?${range}&unit=hour`, key.key);
  await request(`${own}/daterange`, key.key);
  await request(`${own}/stats?period=7d&timezone=UTC`, key.key);
  await request(
    `${own}/breakdown?${range}&fields=${encodeURIComponent(JSON.stringify(['country', 'device']))}`,
    key.key,
  );
  await request(`${own}/journeys?${range}&steps=3`, key.key);
  await request(`${own}/retention?${range}`, key.key);
  await request(`${own}/goals/stats?${range}&type=event&value=feature_used`, key.key);
  const steps = [
    { type: 'path', value: '/guide' },
    { type: 'event', value: 'feature_used' },
  ];
  await request(
    `${own}/funnels/stats?${range}&window=24&steps=${encodeURIComponent(JSON.stringify(steps))}`,
    key.key,
  );
  const first = await request(`${own}/events?${range}&page=1&pageSize=1`, key.key);
  const next = await request(`${own}/events?${range}&page=2&pageSize=1`, key.key);
  assert.equal(first.count, 2);
  assert.equal(first.data.length, 1);
  assert.notEqual(first.data[0].id, next.data[0].id);
  const sessions = await request(`${own}/sessions?${range}&page=1&pageSize=10`, key.key);
  assert.equal(sessions.data[0].id, session);
  await request(`${own}/sessions/${session}`, key.key);
  const links = await request(`${own}/page-links?pagePath=%2Fguide`, key.key);
  assert.equal(links.pages.find(page => page.id === 'overview').path, `/websites/${website}`);
  assert.deepEqual(links.trackedPage.urls, ['https://example.com/guide']);
  assert.equal(links.queryApplied, false);
  await request(`${own}/stats?${range}`, null, 401);
  await request(`${own}/page-links`, 'formami_invalid', 401);
  for (const suffix of ['', `/stats?${range}`, `/events?${range}`, `/sessions/${session}`]) {
    await request(`/api/websites/${foreign}${suffix}`, key.key, 401);
  }
  await request(`/api/websites/${foreign}/page-links`, key.key, 403);
  for (const path of ['/api/me/api-keys', '/teams/test/api/me/api-keys', `/api/users/${owner}`]) {
    await request(path, key.key, 401);
  }
  // Key capabilities continue to follow the existing user's permissions, including writes.
  await request(own, key.key, 200, 'POST', { name: 'Agent synthetic renamed' });
  await request(`/api/websites/${teamWebsite}`, key.key, 200, 'POST', { name: 'Team renamed' });
  sql(`UPDATE team_user SET role='team-view-only' WHERE team_user_id=${quote(membership)};`);
  await request(`/api/websites/${teamWebsite}/stats?${range}`, key.key);
  await request(`/api/websites/${teamWebsite}`, key.key, 401, 'POST', { name: 'Must not change' });
  sql(`DELETE FROM team_user WHERE team_user_id=${quote(membership)};`);
  await request(`/api/websites/${teamWebsite}/page-links`, key.key, 403);
  await request(`/api/websites/${teamWebsite}/stats?${range}`, key.key, 401);
  await request(`/api/me/api-keys/${key.id}`, login, 200, 'DELETE');
  await request(`${own}/stats?${range}`, key.key, 401);
  await request(`${own}/page-links`, key.key, 401);
  await request(`${own}/stats?${range}`, second.key);
  await request(`${own}/stats?${range}`, login);
  const guide = readFileSync(new URL('../docs/agent-api.md', import.meta.url), 'utf8');
  const snippets = [...guide.matchAll(/```python\n([\s\S]*?)\n```/g)].map(match => match[1]);
  const exampleOutput = execFileSync('python', ['-c', snippets.join('\n')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FORMAMI_URL: base,
      FORMAMI_API_TOKEN: second.key,
      FORMAMI_WEBSITE_ID: website,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert(!exampleOutput.includes(second.key));
  passed++;
  // Verify returned navigation entries resolve in the authenticated browser too.
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(token => {
    localStorage.setItem('formami.auth', JSON.stringify(token));
    localStorage.setItem('locale', 'en-US');
  }, login);
  for (const id of ['overview', 'events', 'sessions']) {
    const path = links.pages.find(item => item.id === id).path;
    const response = await page.goto(`${base}${path}`);
    assert.equal(response.status(), 200);
    await page.getByText('Agent synthetic renamed', { exact: true }).first().waitFor();
    if (id === 'overview')
      await page.getByRole('heading', { name: 'Pages', exact: true }).waitFor();
    assert(!page.url().includes('/login'));
    passed++;
  }
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/agent-api-sessions.png', fullPage: true });
  assert.deepEqual(errors, []);
  sql(`UPDATE "user" SET deleted_at=now() WHERE user_id=${quote(owner)};`);
  await request(`${own}/page-links`, second.key, 401);
  console.log(
    `PASS: ${passed} local API/browser/documentation checks, including real token creation/revocation, permissions, team changes, pagination and page links.`,
  );
} finally {
  await browser?.close();
  // Remove only random fixture IDs created by this run, never pre-existing rows.
  sql(`BEGIN;
    DELETE FROM api_key WHERE user_id IN (${quote(owner)},${quote(other)});
    DELETE FROM website_event WHERE website_id=${quote(website)};
    DELETE FROM session WHERE website_id=${quote(website)};
    DELETE FROM website WHERE website_id IN (${quote(website)},${quote(foreign)},${quote(teamWebsite)});
    DELETE FROM team_user WHERE team_user_id=${quote(membership)};
    DELETE FROM team WHERE team_id=${quote(team)};
    DELETE FROM "user" WHERE user_id IN (${quote(owner)},${quote(other)});
    COMMIT;`);
}
