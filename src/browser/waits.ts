import type { Page } from 'puppeteer';

export async function waitForDomReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(isDomReady, { timeout });
}

function isDomReady(): boolean {
  return ['interactive', 'complete'].includes(document.readyState);
}

export async function waitForPageIdle(page: Page, timeout = 10_000, idleTime = 750): Promise<void> {
  try {
    await page.waitForNetworkIdle({ timeout, idleTime });
  } catch {
    // Instagram can keep long polling or analytics requests open. A timeout here should not fail the cleanup.
  }
}
