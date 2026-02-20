import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DSLScreen } from '../types.js';

export async function loadDSLTests(dir = 'tests'): Promise<DSLScreen[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.dsl.json'));
  const parsed: DSLScreen[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), 'utf-8');
    parsed.push(JSON.parse(raw));
  }
  return parsed;
}

export function hasTestId(selector: unknown): boolean {
  return typeof selector === 'string' && selector.trim().length > 0;
}
