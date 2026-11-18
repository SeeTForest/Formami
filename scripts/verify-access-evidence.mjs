// Isolated local integration verification. Never accepts a production URL or credentials.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

const base = 'http://127.0.0.1:3035';
const container = 'forami-local-database-1';
assert.equal(
  execFileSync('docker', ['port', container, '5432'], { encoding: 'utf8' }).trim(),
  '127.0.0.1:55435',
);
const local = dotenv.parse(readFileSync('.env'));
const database = new URL(local.DATABASE_URL);
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.port, '55435');
assert.equal(database.pathname, '/forami');
assert.equal(database.username, 'forami');
assert(
  process.env.npm_execpath && /pnpm/i.test(process.env.npm_execpath),
  'Run pnpm run local:verify:access',
);
let alreadyRunning = false;
try {
  await fetch(`${base}/api/heartbeat`, { signal: AbortSignal.timeout(1000) });
  alreadyRunning = true;
} catch {}
assert(
  !alreadyRunning,
  'Port 3035 must be free; this script starts and stops its own local server.',
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
const [owner, other, website, foreign, runId] = Array.from({ length: 5 }, () => randomUUID());
const username = `access-${owner.slice(0, 8)}`;
const password = randomUUID();
const directory = resolve('test-results', `access-evidence-${runId}`);
mkdirSync(directory, { recursive: true });
const configPath = resolve(directory, 'config.json');
const keysPath = resolve(directory, 'keys.json');
const secretPath = resolve(directory, 'collector.key');
const contentKeys = Array.from({ length: 605 }, (_, i) => `guide_${String(i).padStart(4, '0')}`);
writeFileSync(keysPath, JSON.stringify(contentKeys));
execFileSync(process.execPath, [
  'scripts/access-evidence-admin.mjs',
  'provision',
  '--config',
  configPath,
  '--website',
  website,
  '--content-keys',
  keysPath,
  '--policy',
  'local-public-content-v1',
  '--secret-file',
  secretPath,
]);
const collectorKey = readFileSync(secretPath, 'utf8').trim();
const collectorHeaders = { 'x-formami-access-key': collectorKey };
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const swapConfig = value => {
  writeFileSync(`${configPath}.next`, JSON.stringify(value));
  renameSync(`${configPath}.next`, configPath);
};
const log = openSync(resolve(directory, 'server.log'), 'w');
let server;
let browser;
let passed = 0;
const check = (value, message) => {
  assert(value, message);
  passed++;
};
async function request(path, headers = {}, method = 'GET', body, status = 200) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(response.status, status, `${method} ${path.split('?')[0]} status`);
  passed++;
  return response.json();
}
const path = `/api/websites/${website}/access-evidence`;
const now = Date.now();
const range = `startAt=${now - 3600000}&endAt=${now + 60000}`;
const observations = contentKeys.map((contentKey, i) => ({
  id: randomUUID(),
  occurredAt: new Date(now - 1000).toISOString(),
  source: 'server',
  kind: 'fetch',
  contentKey,
  signal: i % 2 ? 'unknown' : 'gptbot',
  provider: i % 2 ? 'unknown' : 'openai',
  outcome: 'success',
  representation: ['html', 'markdown', 'json', 'context', 'discovery', 'other'][i % 6],
  httpMethod: 'GET',
  statusCode: 200,
  contentVersion: 'local-mapping-v1',
  collectorVersion: '1.0.0',
  collectionPolicyVersion: 'local-public-content-v1',
  synthetic: true,
  verificationRunId: runId,
}));
try {
  sql(`BEGIN;
    INSERT INTO "user"(user_id,username,password,role) VALUES
      (${quote(owner)},${quote(username)},${quote(bcrypt.hashSync(password, 10))},'user'),
      (${quote(other)},${quote(`${username}-other`)},${quote(bcrypt.hashSync(randomUUID(), 10))},'user');
    INSERT INTO website(website_id,name,domain,user_id,created_by) VALUES
      (${quote(website)},'Access synthetic local','example.com',${quote(owner)},${quote(owner)}),
      (${quote(foreign)},'Access foreign local','example.org',${quote(other)},${quote(other)});
    COMMIT;`);
  server = spawn(process.execPath, ['scripts/local-dev.mjs', 'dev'], {
    env: { ...process.env, FORMAMI_ACCESS_CONFIG_FILE: configPath },
    stdio: ['ignore', log, log],
  });
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw new Error('Local server exited before readiness');
    try {
      if ((await fetch(`${base}/api/heartbeat`, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {}
    if (i === 89) throw new Error('Local server did not become ready');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const login = await request('/api/auth/login', {}, 'POST', { username, password });
  const auth = { authorization: `Bearer ${login.token}` };
  const key = await request('/api/me/api-keys', auth, 'POST', {
    name: 'local-access-evidence-verification',
  });
  const readHeaders = { authorization: `Bearer ${key.key}` };
  await request(`${path}?${range}`, {}, 'GET', undefined, 401);
  await request(`${path}?${range}`, collectorHeaders, 'GET', undefined, 401);
  await request(
    `/api/websites/${foreign}/access-evidence?${range}`,
    readHeaders,
    'GET',
    undefined,
    403,
  );
  await request(
    `/api/websites/${foreign}/access-evidence`,
    collectorHeaders,
    'POST',
    { observations: [observations[0]] },
    401,
  );
  await request('/api/websites', collectorHeaders, 'GET', undefined, 401);
  await request(
    path,
    { 'x-formami-access-key': `fae_${'f'.repeat(64)}` },
    'POST',
    { observations: [observations[0]] },
    401,
  );
  for (let i = 0; i < observations.length; i += 100) {
    const batch = observations.slice(i, i + 100);
    const result = await request(path, collectorHeaders, 'POST', { observations: batch });
    check(result.accepted === batch.length && result.duplicates === 0, 'batch accepted');
  }
  const replay = await request(path, collectorHeaders, 'POST', {
    observations: [{ ...observations[0], statusCode: 404 }],
  });
  check(replay.accepted === 0 && replay.duplicates === 1, 'retry deduplicated without overwrite');
  for (const extra of [
    { collectionPolicyVersion: 'unapproved' },
    { contentKey: 'foreign_key' },
    { rawUrl: '/private?token=secret' },
    { consent: 'granted' },
    { occurredAt: '2020-01-01T00:00:00Z' },
    { synthetic: false },
  ]) {
    await request(
      path,
      collectorHeaders,
      'POST',
      { observations: [{ ...observations[0], ...extra }] },
      400,
    );
  }
  await request(path, collectorHeaders, 'POST', 'x'.repeat(65537), 413);
  await request(
    path,
    collectorHeaders,
    'POST',
    { observations: Array(101).fill(observations[0]) },
    400,
  );
  await request(path, readHeaders, 'POST', {
    observations: [
      {
        id: randomUUID(),
        occurredAt: new Date(now).toISOString(),
        consent: 'granted',
        source: 'server',
        kind: 'fetch',
        contentKey: contentKeys[0],
      },
    ],
  });
  const ordinary = {
    ...observations[0],
    id: randomUUID(),
    synthetic: false,
    verificationRunId: undefined,
  };
  await request(path, collectorHeaders, 'POST', { observations: [ordinary] });
  const first = await request(`${path}?${range}&limit=37`, readHeaders);
  const groups = [...first.groups];
  let next = first.pagination.nextOffset;
  while (next !== null) {
    const page = await request(
      `${path}?${range}&limit=37&offset=${next}&snapshotAt=${first.pagination.snapshotAt}`,
      readHeaders,
    );
    check(page.pagination.totalGroups === first.pagination.totalGroups, 'stable total groups');
    groups.push(...page.groups);
    next = page.pagination.nextOffset;
  }
  check(first.pagination.totalGroups === 607 && groups.length === 607, 'all 607 groups paginated');
  check(
    new Set(groups.map(row => JSON.stringify({ ...row, count: undefined }))).size === 607,
    'no repeated group identities',
  );
  check(
    groups.reduce((sum, row) => sum + row.count, 0) === 607 && first.totals.fetch === 607,
    'groups reconcile with complete total',
  );
  check(
    groups.some(row => row.collectionPolicyVersion === null && row.synthetic === null),
    'legacy fields remain unknown',
  );
  check(
    groups.every(row => row.confidence !== 'verified'),
    'no unverified identity promoted',
  );
  const verified = await request(
    `${path}?${range}&synthetic=true&verificationRunId=${runId}&groupBy=day`,
    readHeaders,
  );
  check(
    verified.totals.fetch === 605 && verified.groups.length === 1,
    'run filter and UTC day grouping',
  );
  const nonSynthetic = await request(`${path}?${range}&synthetic=false`, readHeaders);
  check(nonSynthetic.totals.fetch === 1, 'false excludes legacy null');
  const status = await request(`${path}?${range}&statusCode=404`, readHeaders);
  check(status.groups.length === 0, 'duplicate does not overwrite HTTP status');
  const content = await request(`${path}?${range}&groupBy=content&limit=500`, readHeaders);
  check(
    content.pagination.totalGroups === 606 && content.truncated,
    'content aggregation preserves representations and legacy null',
  );
  const cutoff = await request(`${path}?${range}&snapshotAt=${now - 10000}`, readHeaders);
  check(cutoff.groups.length === 0, 'received cutoff excludes later records');
  await request(`${path}?${range}&limit=501`, readHeaders, 'GET', undefined, 400);
  const spec = await request('/openapi.json');
  const post = spec.paths['/api/websites/{websiteId}/access-evidence'].post;
  check(
    post.security.some(item => item.accessCollectorKey),
    'OpenAPI advertises restricted collector authentication',
  );
  swapConfig({
    ...config,
    websites: { [website]: { ...config.websites[website], collectorKeyHashes: [] } },
  });
  await request(path, collectorHeaders, 'POST', { observations: [observations[0]] }, 401);
  await request(`${path}?${range}`, readHeaders);
  writeFileSync(`${configPath}.next`, '{invalid');
  renameSync(`${configPath}.next`, configPath);
  await request(path, collectorHeaders, 'POST', { observations: [observations[0]] }, 503);
  swapConfig(config);
  await request(path, collectorHeaders, 'POST', { observations: [observations[0]] });

  // Browser regression: the existing overview/evidence panel still renders with the expanded response.
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(token => {
    localStorage.setItem('formami.auth', JSON.stringify(token));
    localStorage.setItem('locale', 'en-US');
  }, login.token);
  check(
    (await page.goto(`${base}/websites/${website}`)).status() === 200,
    'browser overview response',
  );
  await page.getByText('Access synthetic local', { exact: true }).first().waitFor();
  await page.getByRole('heading', { name: 'Pages', exact: true }).waitFor();
  await page.getByText('Access and content-use evidence', { exact: true }).click();
  await page.getByText('guide_0000', { exact: true }).first().waitFor();
  check(
    !page.url().includes('/login') && errors.length === 0,
    'browser overview with no runtime errors',
  );
  await page.screenshot({ path: resolve(directory, 'overview.png'), fullPage: true });

  // Only fixture records in the isolated database. Retention must preserve legacy and other websites.
  const oldPolicy = randomUUID();
  const oldLegacy = randomUUID();
  const oldForeign = randomUUID();
  for (const [id, wid, policy] of [
    [oldPolicy, website, true],
    [oldLegacy, website, false],
    [oldForeign, foreign, true],
  ]) {
    sql(`INSERT INTO access_observation(id,website_id,occurred_at,source,kind,content_key,signal,provider,outcome,actor,purpose,evidence,confidence,rule_version,collection_policy_version)
      VALUES(${quote(id)},${quote(wid)},now()-interval '401 days','server','fetch','guide_0000','unknown','unknown','unknown','unknown','unknown','unknown','unknown','local',${policy ? "'local-public-content-v1'" : 'NULL'});`);
  }
  const prune = apply =>
    execFileSync(
      process.execPath,
      [
        'scripts/access-evidence-admin.mjs',
        'prune',
        '--config',
        configPath,
        ...(apply ? ['--apply'] : []),
      ],
      { env: { ...process.env, DATABASE_URL: local.DATABASE_URL }, encoding: 'utf8' },
    );
  check(
    JSON.parse(prune(false)).eligible === 1,
    'retention dry run selects only expired policy records',
  );
  check(JSON.parse(prune(true)).deleted === 1, 'bounded retention deletes only selected evidence');
  check(
    sql(
      `SELECT count(*) FROM access_observation WHERE id IN (${quote(oldLegacy)},${quote(oldForeign)});`,
    ).trim() === '2',
    'retention preserves legacy and foreign website',
  );

  // Real dump/restore into a uniquely named local database; never changes the source database.
  const restoreDatabase = `access_restore_${runId.replaceAll('-', '')}`;
  const dump = execFileSync(
    'docker',
    ['exec', container, 'pg_dump', '-U', 'forami', '-d', 'forami', '-Fc'],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  writeFileSync(resolve(directory, 'local.dump'), dump);
  sql(`CREATE DATABASE ${restoreDatabase};`);
  try {
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        container,
        'pg_restore',
        '-U',
        'forami',
        '-d',
        restoreDatabase,
        '--exit-on-error',
      ],
      { input: dump },
    );
    const restored = execFileSync(
      'docker',
      [
        'exec',
        container,
        'psql',
        '-U',
        'forami',
        '-d',
        restoreDatabase,
        '-At',
        '-c',
        `SELECT count(*) FROM access_observation WHERE website_id=${quote(website)};`,
      ],
      { encoding: 'utf8' },
    );
    check(restored.trim() === '608', 'backup restores all target evidence including legacy');
    const migration = execFileSync(
      'docker',
      [
        'exec',
        container,
        'psql',
        '-U',
        'forami',
        '-d',
        restoreDatabase,
        '-At',
        '-c',
        "SELECT count(*) FROM _prisma_migrations WHERE migration_name='20261118000000_access_content_observations' AND finished_at IS NOT NULL;",
      ],
      { encoding: 'utf8' },
    );
    check(migration.trim() === '1', 'restored additive migration remains applied');
  } finally {
    sql(`DROP DATABASE ${restoreDatabase};`);
  }
  await request(`/api/me/api-keys/${key.id}`, auth, 'DELETE');
  await request(`${path}?${range}`, readHeaders, 'GET', undefined, 401);
  const receipt = {
    passed,
    websiteFixtureRemovedOnExit: true,
    groups: 607,
    productionUsed: false,
    backupRestore: true,
    dumpSha256: createHash('sha256').update(dump).digest('hex'),
    createdAt: new Date().toISOString(),
  };
  writeFileSync(resolve(directory, 'verification.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ ...receipt, evidenceDirectory: directory }));
} finally {
  await browser?.close();
  if (server?.pid) {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {}
    } else server.kill('SIGTERM');
  }
  closeSync(log);
  sql(`BEGIN;
    DELETE FROM api_key WHERE user_id IN (${quote(owner)},${quote(other)});
    DELETE FROM website WHERE website_id IN (${quote(website)},${quote(foreign)});
    DELETE FROM "user" WHERE user_id IN (${quote(owner)},${quote(other)});
    COMMIT;`);
}
