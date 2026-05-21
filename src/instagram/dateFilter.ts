import type { Page } from 'puppeteer';
import type { DateRange, TranslationDictionary } from '../types.js';
import { waitForPageIdle } from '../browser/waits.js';
import { getTranslationValues } from '../translations/loadTranslations.js';
import { logger } from '../utils/logger.js';
import { formatDateForInput, formatRange } from '../utils/time.js';
import { uniqueStrings } from '../utils/text.js';
import { fillDateInputs } from './browser/fillDateInputs.js';
import { hasVisibleInput } from './browser/hasVisibleInput.js';
import { clickByLabels } from './clickByLabels.js';

export async function applyDateFilter(
  page: Page,
  range: DateRange,
  translations: TranslationDictionary,
): Promise<void> {
  if (!range.from && !range.to) {
    return;
  }

  logger.info(`Requested time filter: ${formatRange(range)}`);
  const opened = await clickByLabels(
    page,
    uniqueStrings(getTranslationValues(translations, ['sortFilter', 'filter'])),
    {
      timeout: 7000,
      debugName: 'Sort & filter',
    },
  );

  if (!opened) {
    throw new Error('The date filter could not be opened. No manual fallback was attempted.');
  }

  try {
    await waitForVisibleDateInput(page);
  } catch {
    throw new Error('The date filter fields were not detected. No manual fallback was attempted.');
  }

  const filled = await page.evaluate(fillDateInputs, {
    from: formatDateForInput(range.from),
    to: formatDateForInput(range.to),
  });

  if (!filled) {
    throw new Error(
      'The date filter fields were not recognized. No manual fallback was attempted.',
    );
  }

  const applied = await clickByLabels(
    page,
    uniqueStrings(getTranslationValues(translations, ['apply', 'done'])),
    {
      timeout: 5000,
      preferLast: true,
      debugName: 'Apply',
    },
  );

  if (!applied) {
    throw new Error(
      'The date filter Apply button was not found. No manual fallback was attempted.',
    );
  }

  await waitForPageIdle(page, 10_000, 1_000);
}

async function waitForVisibleDateInput(page: Page): Promise<void> {
  await page.waitForFunction(hasVisibleInput, { timeout: 8_000 });
}
