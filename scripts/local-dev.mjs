import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const action = process.argv[2] ?? 'setup';
if (!['setup', 'dev', 'build', 'test', 'start', 'stop'].includes(action))
  throw new Error('Unknown local action');
if (!existsSync('.env')) {
  if (action !== 'setup') throw new Error('Run local:setup first');
  const password = randomBytes(24).toString('hex');
  writeFileSync(
    '.env',
    [
      '# Local development only. Never use production credentials here.',
      `FORAMI_LOCAL_DB_PASSWORD=${password}`,
      `DATABASE_URL=postgresql://forami:${password}@127.0.0.1:55435/forami`,
      `APP_SECRET=${randomBytes(32).toString('hex')}`,
      'DISABLE_TELEMETRY=1',
      'DISABLE_UPDATES=1',
      'NEXT_TELEMETRY_DISABLED=1',
      'SKIP_BUILD_GEO=1',
      'HOSTNAME=127.0.0.1',
      'PORT=3035',
      '',
    ].join('\n'),
    { flag: 'wx', mode: 0o600 },
  );
  console.log('Created ignored .env with random local credentials.');
}
const config = dotenv.parse(readFileSync('.env'));
for (const file of [
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
]) {
  if (existsSync(file))
    throw new Error(`Remove the local environment override ${file} before using local commands.`);
}
for (const key of [
  'CLICKHOUSE_URL',
  'REDIS_URL',
  'CLOUD_MODE',
  'CLOUD_URL',
  'DATABASE_REPLICA_URL',
  'DIRECT_DATABASE_URL',
  'API_URL',
  'BASE_PATH',
  'COLLECT_API_ENDPOINT',
]) {
  if (config[key])
    throw new Error(`Unexpected ${key} in local .env; use only the isolated database.`);
}
let url;
try {
  url = new URL(config.DATABASE_URL);
} catch {
  throw new Error('Invalid local DATABASE_URL');
}
if (
  url.protocol !== 'postgresql:' ||
  url.hostname !== '127.0.0.1' ||
  url.port !== '55435' ||
  url.pathname !== '/forami' ||
  url.username !== 'forami' ||
  url.search ||
  url.hash ||
  !config.FORAMI_LOCAL_DB_PASSWORD ||
  decodeURIComponent(url.password) !== config.FORAMI_LOCAL_DB_PASSWORD
) {
  throw new Error(
    'Refusing non-local database configuration; expected forami@127.0.0.1:55435/forami.',
  );
}
const env = {
  ...process.env,
  ...config,
  DISABLE_TELEMETRY: '1',
  DISABLE_UPDATES: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  SKIP_BUILD_GEO: '1',
  DIRECT_DATABASE_URL: config.DATABASE_URL,
  TZ: 'UTC',
};
// Do not inherit optional production backends or overrides from the host shell.
for (const key of [
  'CLICKHOUSE_URL',
  'REDIS_URL',
  'CLOUD_MODE',
  'CLOUD_URL',
  'DATABASE_REPLICA_URL',
  'DATABASE_TYPE',
  'SKIP_DB_CHECK',
  'SKIP_DB_MIGRATION',
  'SKIP_DB_SECRET_CHECK',
  'API_URL',
  'BASE_PATH',
  'COLLECT_API_ENDPOINT',
])
  delete env[key];
function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const pnpm = (...args) => {
  if (!process.env.npm_execpath) throw new Error('Use pnpm run local:<action>');
  const executable = process.env.npm_execpath;
  if (/\.[cm]?js$/i.test(executable)) run(process.execPath, [executable, ...args]);
  else run(executable, args);
};
if (action === 'stop') {
  run('docker', ['compose', '-f', 'compose.local.yml', 'stop']);
} else if (action === 'setup') {
  run('docker', ['compose', '-f', 'compose.local.yml', 'up', '-d', '--wait']);
  for (const task of [
    'build:db',
    'check:db',
    'build:tracker',
    'build:recorder',
    'build:openapi',
    'build:packages',
  ])
    pnpm('run', task);
  console.log('Formami is ready. Run local:dev; open http://127.0.0.1:3035.');
} else if (action === 'build') {
  pnpm('run', 'build');
} else if (action === 'test') {
  pnpm('run', 'generate:db:client');
  pnpm('exec', 'vitest', 'run', '--maxWorkers=2');
  pnpm('run', 'test:packages');
} else if (action === 'start') {
  pnpm('exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', '3035');
} else {
  pnpm('exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', '3035');
}
