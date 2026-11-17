#!/usr/bin/env node
import { serveFormamiStdio } from './stdio';

try {
  serveFormamiStdio();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
