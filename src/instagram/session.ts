import type { Page } from 'puppeteer';
import { waitForDomReady, waitForPageIdle } from '../browser/waits.js';
import { logger } from '../utils/logger.js';
import { hasVisibleLoginForm as hasVisibleLoginFormInBrowser } from './browser/hasVisibleLoginForm.js';
import { isLoginUiHidden } from './browser/isLoginUiHidden.js';

async function hasInstagramSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.cookies('https://www.instagram.com/');
  return cookies.some((cookie) => cookie.name === 'sessionid' && cookie.value.length > 0);
}

async function hasVisibleLoginForm(page: Page): Promise<boolean> {
  return page.evaluate(hasVisibleLoginFormInBrowser);
}

async function waitForLoginUiToDisappear(page: Page, timeout: number): Promise<void> {
  await page.waitForFunction(isLoginUiHidden, { timeout, polling: 1_000 });
}

async function isInstagramLoggedIn(page: Page): Promise<boolean> {
  const hasSessionCookie = await hasInstagramSessionCookie(page);

  if (!hasSessionCookie) {
    return false;
  }

  return !(await hasVisibleLoginForm(page));
}

export async function waitForInstagramLogin(page: Page, timeout: number): Promise<void> {
  if (await hasInstagramSessionCookie(page)) {
    logger.debug('Instagram session cookie detected. Opening target page directly.');
    return;
  }

  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await waitForDomReady(page);
  await waitForPageIdle(page, 2_500, 500);

  if (await isInstagramLoggedIn(page)) {
    logger.debug('Instagram session detected. Skipping manual login prompt.');
    return;
  }

  logger.info(
    'Log in inside Chrome if Instagram asks for it. The script is waiting automatically and never reads credentials.',
  );

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const remainingTimeout = Math.max(1_000, timeout - (Date.now() - startedAt));
    await waitForLoginUiToDisappear(page, remainingTimeout);
    await waitForDomReady(page);
    await waitForPageIdle(page, 2_500, 500);

    if (await isInstagramLoggedIn(page)) {
      logger.info('Instagram session detected. Continuing automatically.');
      return;
    }
  }

  throw new Error(`Instagram login was not detected within ${Math.round(timeout / 1000)} seconds.`);
}
