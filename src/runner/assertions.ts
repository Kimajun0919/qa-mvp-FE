import type { Page } from 'playwright';
import { hasTestId } from '../dsl/parser.js';

export async function runExpectation(page: Page, expectObj: Record<string, any>): Promise<{ ok: boolean; expected: string; actual: string; blocked?: boolean }> {
  if (expectObj.elementVisible) {
    if (!hasTestId(expectObj.elementVisible)) return { ok: false, expected: 'data-testid required', actual: 'missing testid', blocked: true };
    const locator = page.getByTestId(expectObj.elementVisible);
    const count = await locator.count();
    if (count === 0) return { ok: false, expected: `${expectObj.elementVisible} visible`, actual: 'element not found' };
    return { ok: await locator.first().isVisible(), expected: `${expectObj.elementVisible} visible`, actual: 'checked' };
  }
  if (expectObj.elementDisabled) {
    if (!hasTestId(expectObj.elementDisabled)) return { ok: false, expected: 'data-testid required', actual: 'missing testid', blocked: true };
    const locator = page.getByTestId(expectObj.elementDisabled);
    const count = await locator.count();
    if (count === 0) return { ok: false, expected: `${expectObj.elementDisabled} disabled`, actual: 'element not found' };
    return { ok: await locator.first().isDisabled(), expected: `${expectObj.elementDisabled} disabled`, actual: 'checked' };
  }
  if (expectObj.urlIncludes) {
    return { ok: page.url().includes(expectObj.urlIncludes), expected: `url includes ${expectObj.urlIncludes}`, actual: page.url() };
  }
  return { ok: false, expected: JSON.stringify(expectObj), actual: 'unsupported expect' };
}
