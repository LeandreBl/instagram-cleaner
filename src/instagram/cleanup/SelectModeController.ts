import { waitForDomReady, waitForPageIdle } from '../../browser/waits.js';
import { clickByLabels } from '../clickByLabels.js';
import type { CleanupContext } from './CleanupContext.js';
import { hasVisibleSelectionControl } from './browser/hasVisibleSelectionControl.js';
import { getSelectableItemsSelector, getSelectionModeSelector } from './selectors.js';

const maxSelectModeAttempts = 3;
const selectModeRefreshTimeoutMs = 90_000;

export class SelectModeController {
  public constructor(private readonly context: CleanupContext) {}

  public async ensure(): Promise<void> {
    for (let attempt = 1; attempt <= maxSelectModeAttempts; attempt += 1) {
      if (await this.isActive()) {
        return;
      }

      const selected = await clickByLabels(this.context.page, this.context.target.selectLabels, {
        timeout: 10_000,
        exact: true,
        includeTextElements: true,
        waitAfterClickTimeout: 750,
        waitAfterClickIdleTime: 150,
        debugName: 'Select',
      });

      if (!selected) {
        await this.refreshBeforeRetry(attempt, 'The Select button was not found yet.');
        continue;
      }

      const selectionDetected = await this.waitForSelectionMode();

      if (selectionDetected || (await this.hasSelectableItems())) {
        return;
      }

      await this.refreshBeforeRetry(attempt, 'Selection mode was not detected yet.');
    }

    throw new Error('The Select button was not found after refreshing the page.');
  }

  private async isActive(): Promise<boolean> {
    return this.context.page.evaluate(hasVisibleSelectionControl, getSelectionModeSelector());
  }

  private async hasSelectableItems(): Promise<boolean> {
    return this.context.page.evaluate(hasVisibleSelectionControl, getSelectableItemsSelector());
  }

  private async waitForSelectionMode(): Promise<boolean> {
    return this.context.page
      .waitForFunction(
        hasVisibleSelectionControl,
        { timeout: 1_200, polling: 100 },
        getSelectionModeSelector(),
      )
      .then(async (handle) => {
        await handle.dispose();
        return true;
      })
      .catch(() => false);
  }

  private async refreshBeforeRetry(attempt: number, reason: string): Promise<void> {
    if (attempt >= maxSelectModeAttempts) {
      return;
    }

    this.context.warn(`${reason} Refreshing the activity page before retrying.`);

    try {
      await this.context.page.reload({
        waitUntil: 'domcontentloaded',
        timeout: selectModeRefreshTimeoutMs,
      });
    } catch (error) {
      this.context.warn(
        `Page refresh did not settle cleanly: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.context.page.goto(this.context.target.url, {
        waitUntil: 'domcontentloaded',
        timeout: selectModeRefreshTimeoutMs,
      });
    }

    await waitForDomReady(this.context.page, selectModeRefreshTimeoutMs);
    await waitForPageIdle(this.context.page, 10_000, 1_000);
  }
}
