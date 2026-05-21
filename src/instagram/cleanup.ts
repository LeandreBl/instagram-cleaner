import type { Page } from 'puppeteer';
import type { CleanupOptions, TargetConfiguration, TranslationDictionary } from '../types.js';
import { CleanupContext } from './cleanup/CleanupContext.js';
import { CleanupRunner } from './cleanup/CleanupRunner.js';

export async function cleanupHistory(
  page: Page,
  target: TargetConfiguration,
  translations: TranslationDictionary,
  options: CleanupOptions,
): Promise<number> {
  const context = new CleanupContext(page, target, translations, options);
  return new CleanupRunner(context).run();
}
