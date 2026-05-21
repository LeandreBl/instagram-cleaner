import { waitForDomReady, waitForPageIdle } from '../../browser/waits.js';
import type { CleanupContext } from './CleanupContext.js';
import { collectVisibleItemSignatures as collectVisibleItemSignaturesInBrowser } from './browser/collectVisibleItemSignatures.js';
import { haveSelectedItemsDisappeared } from './browser/haveSelectedItemsDisappeared.js';
import { getSelectableItemsSelector } from './selectors.js';

export class PostVisibilityVerifier {
  public constructor(private readonly context: CleanupContext) {}

  public async waitForSelectedItemsToDisappear(timeout = 60_000): Promise<string[]> {
    const signatures = this.getCurrentSelectionSignatures();
    if (signatures.length === 0) {
      this.context.warn(
        'No stable post identifiers were detected for this batch. Skipping post-id check.',
      );
      return [];
    }

    try {
      await this.waitUntilSelectedItemsDisappear(signatures, timeout);
      return [];
    } catch (error) {
      this.context.debug(
        `Selected item disappearance check did not settle: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.collectRemainingSignatures(signatures);
    }
  }

  public async refreshAndCollectRemainingSelectedItems(timeout = 120_000): Promise<string[]> {
    const signatures = this.getCurrentSelectionSignatures();
    if (signatures.length === 0) {
      return [];
    }

    this.context.warn(
      'Selected items are still visible after cleanup confirmation. Refreshing the page to recover from a possible Instagram throttle/loading loop.',
    );

    await this.refreshPage(timeout);
    await waitForPageIdle(this.context.page, timeout, 1_500);

    return this.collectRemainingSignatures(signatures);
  }

  private async waitUntilSelectedItemsDisappear(
    previousSignatures: string[],
    timeout: number,
  ): Promise<void> {
    await this.context.page.waitForFunction(
      haveSelectedItemsDisappeared,
      { timeout, polling: 250 },
      { previousSignatures, selector: getSelectableItemsSelector() },
    );
  }

  private async collectVisibleItemSignatures(): Promise<string[]> {
    return this.context.page.evaluate(
      collectVisibleItemSignaturesInBrowser,
      getSelectableItemsSelector(),
    );
  }

  private async collectRemainingSignatures(previousSignatures: string[]): Promise<string[]> {
    try {
      const currentSignatures = await this.collectVisibleItemSignatures();
      return previousSignatures.filter((signature) => currentSignatures.includes(signature));
    } catch (error) {
      this.context.warn(
        `Could not inspect visible posts after cleanup: ${error instanceof Error ? error.message : String(error)}`,
      );
      return previousSignatures;
    }
  }

  private getCurrentSelectionSignatures(): string[] {
    return Array.from(new Set(this.context.currentSelection.signatures));
  }

  private async refreshPage(timeout: number): Promise<void> {
    try {
      await this.context.page.reload({ waitUntil: 'domcontentloaded', timeout });
    } catch (error) {
      this.context.warn(
        `Page refresh did not settle cleanly: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.context.page.goto(this.context.target.url, {
        waitUntil: 'domcontentloaded',
        timeout,
      });
    }

    await waitForDomReady(this.context.page, timeout);
  }
}
