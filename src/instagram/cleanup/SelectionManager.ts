import { waitForPageIdle } from '../../browser/waits.js';
import type { CleanupContext } from './CleanupContext.js';
import {
  clickSelectionTargetByKey,
  collectNextVisibleBatchTarget,
  collectSelectionResult,
  isSelectionTargetChecked,
} from './browser/selectVisibleBatch.js';
import { getCheckboxCandidateSelector, getSelectableItemsSelector } from './selectors.js';
import { ScrollManager } from './ScrollManager.js';
import type { SelectionResult } from './types.js';

const maxSelectionPasses = 12;
const selectionClickRetries = 3;
const selectionClickRetryDelayMs = 150;
const clickSelectionCheckDelayMs = 150;

export class SelectionManager {
  private readonly scrollManager: ScrollManager;

  public constructor(private readonly context: CleanupContext) {
    this.scrollManager = new ScrollManager(context);
  }

  public async selectBatch(): Promise<SelectionResult> {
    const targetCount = this.context.batchSize;
    let selection = this.emptySelection();

    for (let pass = 0; pass < maxSelectionPasses && selection.count < targetCount; pass += 1) {
      const previousCount = selection.count;
      const visibleSelection = await this.selectVisibleBatch(targetCount - selection.count);
      selection = this.mergeSelection(selection, visibleSelection);

      if (selection.count >= targetCount) {
        break;
      }

      const scroll = await this.scrollManager.scrollMore();
      if (scroll.before === scroll.after) {
        break;
      }

      if (selection.count > previousCount) {
        this.context.debug(
          `Selected ${selection.count}/${targetCount} item(s). Scrolling for more.`,
        );
      }

      await waitForPageIdle(this.context.page, 2_000, 500);
    }

    await waitForPageIdle(this.context.page, 1_500, 250);
    this.context.setSelection(selection);
    return selection;
  }

  private async selectVisibleBatch(batchSize: number): Promise<SelectionResult> {
    let attemptedCount = 0;
    const attemptedKeys: string[] = [];

    for (; attemptedCount < batchSize; attemptedCount += 1) {
      const target = await this.context.page.evaluate(collectNextVisibleBatchTarget, {
        checkboxSelector: getCheckboxCandidateSelector(),
        controlText: this.context.controlText,
        ignoredKeys: attemptedKeys,
      });

      if (!target) {
        break;
      }

      attemptedKeys.push(target.key);
      const selected = await this.clickSelectionTarget(target.key);

      if (!selected) {
        this.context.debug(`Selection click did not register for target ${target.key}.`);
      }

      await this.delay(this.randomClickDelay());
    }

    await this.delay(this.randomClickDelay());

    return this.context.page.evaluate(collectSelectionResult, {
      attemptedCount,
      checkboxSelector: getSelectableItemsSelector(),
    });
  }

  private async clickSelectionTarget(key: string): Promise<boolean> {
    for (let attempt = 0; attempt < selectionClickRetries; attempt += 1) {
      const clicked = await this.context.page.evaluate(clickSelectionTargetByKey, {
        checkboxSelector: getSelectableItemsSelector(),
        controlText: this.context.controlText,
        key,
      });

      if (clicked) {
        await this.delay(clickSelectionCheckDelayMs);

        if (await this.isSelectionTargetChecked(key)) {
          return true;
        }
      }

      await this.delay(selectionClickRetryDelayMs);
    }

    return false;
  }

  private async isSelectionTargetChecked(key: string): Promise<boolean> {
    return this.context.page.evaluate(isSelectionTargetChecked, {
      checkboxSelector: getSelectableItemsSelector(),
      controlText: this.context.controlText,
      key,
    });
  }

  private emptySelection(): SelectionResult {
    return {
      count: 0,
      confirmedCount: null,
      attemptedCount: 0,
      signatures: [],
    };
  }

  private mergeSelection(
    currentSelection: SelectionResult,
    nextSelection: SelectionResult,
  ): SelectionResult {
    const confirmedCount = nextSelection.confirmedCount ?? currentSelection.confirmedCount;
    const count = nextSelection.confirmedCount ?? currentSelection.count + nextSelection.count;
    const signatures = Array.from(
      new Set([...currentSelection.signatures, ...nextSelection.signatures]),
    );

    return {
      count,
      confirmedCount,
      attemptedCount: currentSelection.attemptedCount + nextSelection.attemptedCount,
      signatures: signatures.slice(0, count),
    };
  }

  private randomClickDelay(): number {
    const min = Math.max(0, Math.floor(this.context.options.clickDelay.min));
    const max = Math.max(min, Math.floor(this.context.options.clickDelay.max));

    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private delay(duration: number): Promise<void> {
    return new Promise((resolve) => {
      globalThis.setTimeout(resolve, duration);
    });
  }
}
