#!/usr/bin/env node
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function fail(msg) {
  console.error(`\n[preflight] ${msg}\n`);
  process.exit(1);
}

const major = Number(process.versions.node.split('.')[0]);
if (major !== 22) {
  fail(
    `Node ${process.versions.node} detected. This project is pinned to Node 22.x.\n` +
      `Use: nvm use 22 (or install Node 22)`,
  );
}

try {
  require('better-sqlite3');
} catch (e) {
  fail(
    `better-sqlite3 ABI mismatch detected.\n` +
      `Run in project root:\n` +
      `  npm rebuild better-sqlite3 --build-from-source\n` +
      `or\n` +
      `  npm install\n` +
      `Original: ${String(e?.message || e)}`,
  );
}

console.log('[preflight] OK');
