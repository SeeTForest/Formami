// Local synthetic verification only. No .env or production credentials are read.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
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
const userId = randomUUID(),
  websiteId = randomUUID();
const username = `formami-check-${randomUUID().slice(0, 8)}`;
const password = randomUUID(); // Ephemeral local test user, never printed or retained.
const sessions = [randomUUID(), randomUUID(), randomUUID()];
const now = Date.now();
const range = `startAt=${now - 3600000}&endAt=${now + 60000}`;
let browser;
let passed = 0;
try {
  sql(`BEGIN;
    INSERT INTO "user"(user_id,username,password,role) VALUES (${quote(userId)},${quote(username)},${quote(bcrypt.hashSync(password, 10))},'admin');
    INSERT INTO website(website_id,name,domain,user_id,created_by) VALUES (${quote(websiteId)},'Formami synthetic product','example.com',${quote(userId)},${quote(userId)});
    ${sessions.map((id, i) => `INSERT INTO session(session_id,website_id,country,browser,os,device) VALUES (${quote(id)},${quote(websiteId)},${quote(['CN', 'TW', 'US'][i])},'chrome','Windows 10','desktop');`).join('\n')}
    ${[0, 1, 1, 2].map((index, i) => `INSERT INTO website_event(event_id,website_id,session_id,visit_id,url_path,url_query,hostname,event_type) VALUES (${quote(randomUUID())},${quote(websiteId)},${quote(sessions[index])},${quote(sessions[index])},${quote(i === 0 ? '/' : '/中文')},'q=public','example.com',1);`).join('\n')}
    COMMIT;`);
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const get = async path => {
    const response = await fetch(`${base}/api/websites/${websiteId}/${path}`, { headers });
    assert.equal(response.status, 200, path);
    return response.json();
  };
  const countries = await get(`metrics?${range}&type=country`);
  assert.deepEqual(
    countries.map(({ x, y }) => [x, y]),
    [
      ['CN', 2],
      ['US', 1],
    ],
  );
  passed++;
  const expanded = await get(`metrics/expanded?${range}&type=country`);
  assert.equal(expanded.find(row => row.name === 'CN').visitors, 2);
  assert.equal(Number(expanded.find(row => row.name === 'CN').pageviews), 3);
  passed++;
  assert.deepEqual(await get(`metrics?${range}&type=country&country=eq.TW`), [{ x: 'CN', y: 2 }]);
  assert.deepEqual(await get(`metrics?${range}&type=country&country=neq.CN`), [{ x: 'US', y: 1 }]);
  passed++;
  const breakdown = await get(
    `breakdown?${range}&fields=${encodeURIComponent(JSON.stringify(['country']))}`,
  );
  assert.equal(breakdown.length, 2);
  assert.equal(breakdown.find(row => row.country === 'CN').visitors, 2);
  passed++;
  const values = await get(`values?${range}&type=country`);
  assert(!JSON.stringify(values).includes('TW'));
  passed++;
  const realtimeResponse = await fetch(`${base}/api/realtime/${websiteId}`, { headers });
  assert.equal(realtimeResponse.status, 200);
  const realtime = await realtimeResponse.json();
  assert.equal(realtime.countries.CN, 2);
  assert(!('TW' in realtime.countries));
  passed++;

  const evidencePath = `${base}/api/websites/${websiteId}/access-evidence`;
  const observations = ['gptbot', 'chatgpt_user', 'googlebot', 'user_action', 'browser'].map(
    signal => ({
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      consent: 'granted',
      source: 'server',
      kind: 'fetch',
      contentKey: 'guide',
      signal,
      outcome: 'success',
    }),
  );
  for (const kind of ['citation', 'referral', 'conversion'])
    observations.push({
      ...observations[0],
      id: randomUUID(),
      source: kind === 'conversion' ? 'backend' : 'manual',
      kind,
      signal: 'unknown',
    });
  const send = body => fetch(evidencePath, { method: 'POST', headers, body: JSON.stringify(body) });
  const sent = await send({ observations });
  assert.equal(sent.status, 200);
  assert.deepEqual(await sent.json(), { accepted: 8, duplicates: 0 });
  assert.deepEqual(await (await send({ observations })).json(), { accepted: 0, duplicates: 8 });
  passed++;
  const evidence = await get(`access-evidence?${range}`);
  assert.deepEqual(evidence.totals, { citation: 1, conversion: 1, fetch: 5, referral: 1 });
  assert.equal(evidence.actualTrainingUse, 'unknown');
  assert.equal(
    evidence.groups.find(row => row.purpose === 'training_collection').evidence,
    'ua_declaration',
  );
  passed++;
  assert.equal(
    (await send({ observations: [{ ...observations[0], id: randomUUID(), consent: 'denied' }] }))
      .status,
    400,
  );
  assert.equal(
    (
      await fetch(evidencePath, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ observations }),
      })
    ).status,
    401,
  );
  passed++;
  // The independent channel must not inflate page/visitor metrics.
  assert.deepEqual(await get(`metrics?${range}&type=country`), countries);
  passed++;
  const update = await fetch(`${base}/api/websites/${websiteId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pageOrigins: 'https://example.com,http://localhost:3030' }),
  });
  assert.equal(update.status, 200);
  passed++;

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(token => {
    localStorage.setItem('formami.auth', JSON.stringify(token));
    localStorage.setItem('locale', 'en-US');
  }, token);
  await page.goto(`${base}/websites/${websiteId}`);
  await page.getByRole('heading', { name: 'Pages', exact: true }).waitFor();
  const links = page.locator('a[target="_blank"][href="https://example.com/"]');
  await links.first().waitFor();
  assert.equal(await links.first().getAttribute('rel'), 'noreferrer noopener');
  assert(await page.locator('a[href="http://localhost:3030/"]').count());
  assert(await page.locator('a[href*="path=eq."]').count());
  passed++;
  await page.getByRole('tab', { name: 'URL', exact: true }).first().click();
  await page.locator('a[target="_blank"][href*="q=public"]').first().waitFor();
  passed++;
  mkdirSync('test-results', { recursive: true });
  await page.waitForTimeout(600); // Let existing metric-count animations settle before visual QA.
  await page
    .getByRole('heading', { name: 'Pages', exact: true })
    .locator('..')
    .screenshot({ path: 'test-results/product-pages.png' });
  const summary = page.locator('summary').filter({ hasText: 'Access and content-use evidence' });
  await summary.click();
  await page.getByText('Training collection (claimed)', { exact: true }).last().waitFor();
  mkdirSync('test-results', { recursive: true });
  await page.locator('details').screenshot({ path: 'test-results/product-iteration-desktop.png' });
  await page.getByLabel('Visitor type', { exact: false }).selectOption('agent');
  await page.waitForFunction(() =>
    document.querySelector('details')?.innerText.includes('Fetch: 1'),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await summary.scrollIntoViewIfNeeded();
  await page.locator('details').screenshot({ path: 'test-results/product-iteration-mobile.png' });
  assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  assert.deepEqual(errors, []);
  passed++;
  console.log(`PASS: ${passed} local PostgreSQL/API/browser checks; screenshots in test-results/.`);
} finally {
  await browser?.close();
  // Only fixtures created above; no pre-existing local or production data is touched.
  sql(`BEGIN;
    DELETE FROM access_observation WHERE website_id=${quote(websiteId)};
    DELETE FROM website_event WHERE website_id=${quote(websiteId)};
    DELETE FROM session WHERE website_id=${quote(websiteId)};
    DELETE FROM website WHERE website_id=${quote(websiteId)};
    DELETE FROM "user" WHERE user_id=${quote(userId)};
    COMMIT;`);
}
