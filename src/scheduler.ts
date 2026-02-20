import cron from 'node-cron';
import { readFileSync } from 'node:fs';
import { executeOnce } from './run_once.js';
import type { QAConfig } from './types.js';

export function startScheduler() {
  const config = JSON.parse(readFileSync('qa.config.json', 'utf-8')) as QAConfig;
  console.log(`[scheduler] cron=${config.scheduleCron}`);
  cron.schedule(config.scheduleCron, async () => {
    await executeOnce();
  });
}
