import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';

export async function saveArtifacts(page: Page, runId: string, testId: string) {
  const dir = path.join('artifacts', runId);
  await mkdir(dir, { recursive: true });
  const screenshotPath = path.join(dir, `${testId}.png`);
  const htmlPath = path.join(dir, `${testId}.html`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await writeFile(htmlPath, await page.content(), 'utf-8');
  return { screenshotPath, htmlPath };
}
