import { FormamiClient, type FormamiClientOptions } from '@formami/api-client';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { type McpLogger, stderrLogger } from './lib/logger';
import { createFormamiMcpServer } from './server';

export interface StdioEnvironment {
  FORMAMI_URL?: string;
  FORMAMI_API_URL?: string;
  FORMAMI_API_TOKEN?: string;
  FORMAMI_API_KEY?: string;
  [key: string]: string | undefined;
}

function trimSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

/**
 * Resolves client options from environment variables:
 *
 * - `FORMAMI_API_URL` — full API base URL (e.g. `https://analytics.example.com/api`, `https://example.com/api`).
 * - `FORMAMI_URL` — self-hosted instance URL; `/api` is appended automatically.
 * - `FORMAMI_API_TOKEN` — bearer token (login token or self-hosted API key).
 * - `FORMAMI_API_KEY` — Formami instance API key.
 */
export function resolveClientOptions(env: StdioEnvironment = process.env): FormamiClientOptions {
  const apiUrl = env.FORMAMI_API_URL?.trim();
  const instanceUrl = env.FORMAMI_URL?.trim();
  const token = env.FORMAMI_API_TOKEN?.trim();
  const apiKey = env.FORMAMI_API_KEY?.trim();

  if (!token && !apiKey) {
    throw new Error(
      'Missing credentials. Set FORMAMI_API_TOKEN (self-hosted API key or login token) or FORMAMI_API_KEY (instance API key).',
    );
  }

  let baseUrl: string | undefined;

  if (apiUrl) {
    baseUrl = trimSlashes(apiUrl);
  } else if (instanceUrl) {
    const trimmed = trimSlashes(instanceUrl);
    baseUrl = /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
  }

  if (!baseUrl) throw new Error('Set FORMAMI_API_URL or FORMAMI_URL to your Formami instance.');
  return { baseUrl, token, apiKey };
}

export interface ServeStdioOptions {
  env?: StdioEnvironment;
  logger?: McpLogger;
}

/** Serves the Formami MCP server over stdio for local agents (Claude Desktop, Cursor, …). */
export function serveFormamiStdio(options: ServeStdioOptions = {}) {
  const client = new FormamiClient(resolveClientOptions(options.env));
  const logger = options.logger ?? stderrLogger;

  return serveStdio(() => createFormamiMcpServer({ client, logger }));
}
