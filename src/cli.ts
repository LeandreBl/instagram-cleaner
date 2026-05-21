#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import { launchBrowser, type BrowserSessionOptions } from './browser/launchBrowser.js';
import { waitForDomReady, waitForPageIdle } from './browser/waits.js';
import { parseCliOptions } from './cli/parseCliOptions.js';
import { cleanupHistory } from './instagram/cleanup.js';
import { applyDateFilter } from './instagram/dateFilter.js';
import { waitForInstagramLogin } from './instagram/session.js';
import { buildTarget } from './instagram/targets.js';
import { loadTranslations } from './translations/loadTranslations.js';
import type {
  CleanupOptions,
  CliOptions,
  TargetConfiguration,
  TranslationDictionary,
} from './types.js';
import { configureDesktopNotifications } from './utils/desktopNotification.js';
import { logger, setLogLevel } from './utils/logger.js';
import { formatRange } from './utils/time.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const rootDirectory = path.resolve(currentDirectory, '..');
const browserCloseTimeoutMs = 5_000;
const cleanupRecoveryNavigationTimeoutMs = 120_000;
const cleanupRecoveryRetryDelayMs = 10_000;

type ShutdownSignal = 'SIGINT' | 'SIGTERM' | 'SIGHUP';

interface BrowserLifecycle {
  close(reason: string): Promise<void>;
  uninstall(): void;
}

interface CleanupJob {
  page: Page;
  target: TargetConfiguration;
}

function logRunConfiguration(options: CliOptions): void {
  logger.debug(`Modes: ${options.modes.join(', ')}`);
  logger.debug(`Period: ${formatRange(options.range)}`);
  logger.debug(`Click delay: ${options.clickDelay.min}:${options.clickDelay.max} ms`);
  logger.debug(`Recover on error: ${options.recoverOnError ? 'enabled' : 'disabled'}`);
}

function buildBrowserSessionOptions(options: CliOptions): BrowserSessionOptions {
  return {
    rootDir: rootDirectory,
    useSystemProfile: options.useSystemProfile,
    noSandbox: options.noSandbox,
    ...(options.profileDir !== undefined ? { profileDir: options.profileDir } : {}),
    ...(options.profileName !== undefined ? { profileName: options.profileName } : {}),
    ...(options.chromeExecutablePath !== undefined
      ? { chromeExecutablePath: options.chromeExecutablePath }
      : {}),
  };
}

function buildCleanupOptions(options: CliOptions): CleanupOptions {
  const cleanupOptions: CleanupOptions = {
    batchSize: options.batchSize,
    clickDelay: options.clickDelay,
    dryRun: options.dryRun,
  };

  if (options.limit !== undefined) {
    cleanupOptions.limit = options.limit;
  }

  return cleanupOptions;
}

function signalExitCode(signal: ShutdownSignal): number {
  return 128 + (signal === 'SIGINT' ? 2 : signal === 'SIGTERM' ? 15 : 1);
}

async function closeBrowser(browser: Browser, reason: string): Promise<void> {
  if (!browser.connected) {
    return;
  }

  logger.debug(`Closing Chrome (${reason}).`);

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutId = globalThis.setTimeout(() => resolve('timeout'), browserCloseTimeoutMs);
  });
  const closed = browser.close().then(() => 'closed' as const);
  let result: 'closed' | 'timeout';

  try {
    result = await Promise.race([closed, timeout]);
  } catch (error) {
    browser.process()?.kill('SIGKILL');
    throw error;
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }

  if (result === 'timeout') {
    logger.warn('Chrome did not close in time. Killing the browser process.');
    browser.process()?.kill('SIGKILL');
  }
}

function installBrowserLifecycle(browser: Browser): BrowserLifecycle {
  let cleanupPromise: Promise<void> | null = null;

  const cleanup = (reason: string): Promise<void> => {
    cleanupPromise ??= closeBrowser(browser, reason);
    return cleanupPromise;
  };

  const handleSignal = (signal: ShutdownSignal): void => {
    void cleanup(signal)
      .catch((error: unknown) => {
        logger.error(
          `Error while closing Chrome: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        process.exit(signalExitCode(signal));
      });
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
  process.once('SIGHUP', handleSignal);

  return {
    close: cleanup,
    uninstall(): void {
      process.off('SIGINT', handleSignal);
      process.off('SIGTERM', handleSignal);
      process.off('SIGHUP', handleSignal);
    },
  };
}

function createCleanupJobs(firstPage: Page, targets: TargetConfiguration[]): CleanupJob[] {
  const jobs: CleanupJob[] = [];
  firstPage.setDefaultTimeout(30_000);

  for (const target of targets) {
    jobs.push({ page: firstPage, target });
  }

  return jobs;
}

async function runCleanupJob(
  job: CleanupJob,
  translations: TranslationDictionary,
  options: CliOptions,
): Promise<number> {
  const { page, target } = job;

  logger.info(`[${target.mode}] Opening activity page.`);
  await page.bringToFront();
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await waitForDomReady(page);
  await waitForPageIdle(page, 3_000, 500);
  await applyDateFilter(page, options.range, translations);

  const total = await cleanupHistory(page, target, translations, buildCleanupOptions(options));

  logger.info(`[${target.mode}] Done. Selected/processed items: ${total}.`);
  return total;
}

async function runCleanupJobs(
  jobs: CleanupJob[],
  translations: TranslationDictionary,
  options: CliOptions,
): Promise<number> {
  let total = 0;

  for (const job of jobs) {
    total += await runCleanupJob(job, translations, options);
  }

  return total;
}

async function runCleanupLoop(
  page: Page,
  jobs: CleanupJob[],
  translations: TranslationDictionary,
  options: CliOptions,
): Promise<boolean> {
  while (true) {
    try {
      await waitForInstagramLogin(page, options.loginTimeout);
      const total = await runCleanupJobs(jobs, translations, options);

      logger.info(`Done. Total selected/processed items: ${total}.`);
      logger.info('Chrome stays open for verification. Close the window when you are finished.');
      return true;
    } catch (error) {
      if (!options.recoverOnError) {
        logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
        return false;
      }

      await recoverCleanupLoop(page, jobs, error);
    }
  }
}

async function recoverCleanupLoop(page: Page, jobs: CleanupJob[], error: unknown): Promise<void> {
  const target = jobs[0]?.target;
  logger.warn(
    [
      'Cleanup lost track of the Instagram page.',
      `Reason: ${error instanceof Error ? error.message : String(error)}`,
      'Refreshing the activity page and restarting the cleanup loop.',
    ].join(' '),
  );

  if (!target) {
    await delay(cleanupRecoveryRetryDelayMs);
    return;
  }

  try {
    await page.bringToFront();
    await page.goto(target.url, {
      waitUntil: 'domcontentloaded',
      timeout: cleanupRecoveryNavigationTimeoutMs,
    });
    await waitForDomReady(page, cleanupRecoveryNavigationTimeoutMs);
    await waitForPageIdle(page, 15_000, 1_000);
  } catch (recoveryError) {
    logger.warn(
      [
        'Could not refresh the activity page cleanly.',
        `Reason: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
        `Retrying in ${Math.ceil(cleanupRecoveryRetryDelayMs / 1000)}s.`,
      ].join(' '),
    );
    await delay(cleanupRecoveryRetryDelayMs);
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, durationMs);
  });
}

async function main(): Promise<void> {
  const options = parseCliOptions(rootDirectory);
  setLogLevel(options.logLevel);
  configureDesktopNotifications(options.notifyPrompts);
  const translations = loadTranslations(options.translationsPath);
  const targets = options.modes.map((mode) => buildTarget(mode, translations));

  logRunConfiguration(options);

  const { browser, page, profileDirectory, userDataDir } = await launchBrowser(
    buildBrowserSessionOptions(options),
  );

  logger.debug(`Chrome profile: ${userDataDir}`);
  if (profileDirectory) {
    logger.debug(`Chrome profile directory: ${profileDirectory}`);
  }

  const browserLifecycle = installBrowserLifecycle(browser);

  try {
    const jobs = createCleanupJobs(page, targets);
    const keepBrowserOpen = await runCleanupLoop(page, jobs, translations, options);

    if (!keepBrowserOpen) {
      await browserLifecycle.close('program stopped before completion');
    }
  } catch (error) {
    await browserLifecycle.close('uncaught error');
    throw error;
  } finally {
    browserLifecycle.uninstall();
  }
}

main().catch((error: unknown) => {
  logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
