import type { CleanupContext } from './CleanupContext.js';
import { BatchActionRunner } from './BatchActionRunner.js';
import { PostVisibilityVerifier } from './PostVisibilityVerifier.js';
import { ScrollManager } from './ScrollManager.js';
import { SelectionManager } from './SelectionManager.js';
import { SelectModeController } from './SelectModeController.js';

const selectedItemsDisappearTimeoutMs = 60_000;

export class CleanupRunner {
  private readonly actionRunner: BatchActionRunner;
  private readonly postVisibilityVerifier: PostVisibilityVerifier;
  private readonly scrollManager: ScrollManager;
  private readonly selectionManager: SelectionManager;
  private readonly selectModeController: SelectModeController;

  public constructor(private readonly context: CleanupContext) {
    this.actionRunner = new BatchActionRunner(context);
    this.postVisibilityVerifier = new PostVisibilityVerifier(context);
    this.scrollManager = new ScrollManager(context);
    this.selectionManager = new SelectionManager(context);
    this.selectModeController = new SelectModeController(context);
  }

  public async run(): Promise<number> {
    while (true) {
      if (this.context.hasReachedLimit) {
        this.context.info(`Limit reached: ${this.context.options.limit}`);
        break;
      }

      await this.waitBeforeNextBatchIfThrottled();

      await this.selectModeController.ensure();
      const selection = await this.selectionManager.selectBatch();

      if (selection.count === 0) {
        this.context.markEmptyPass();
        const scroll = await this.scrollManager.scrollMore();

        if (this.context.emptyPasses >= 3 || scroll.before === scroll.after) {
          this.context.info('No selectable item is visible anymore. Done.');
          break;
        }

        await this.scrollManager.waitAfterEmptyPass();
        continue;
      }

      this.context.resetEmptyPasses();
      this.context.debug(`Selected batch: ${selection.count} item(s).`);

      if (selection.attemptedCount > selection.count) {
        this.context.warn(
          `Instagram registered ${selection.count} selected item(s) after ${selection.attemptedCount} click(s). Continuing with the registered selection only.`,
        );
      }

      if (selection.confirmedCount !== null) {
        this.context.debug(`Instagram selection counter: ${selection.confirmedCount} item(s).`);
      }

      if (this.context.options.dryRun) {
        this.context.addProcessed(selection.count);
        this.context.info('Dry-run mode: no deletion was performed.');
        break;
      }

      const actionResult = await this.actionRunner.run();
      if (actionResult.status === 'recovered-error-dialog') {
        continue;
      }

      const remainingSignatures = await this.postVisibilityVerifier.waitForSelectedItemsToDisappear(
        selectedItemsDisappearTimeoutMs,
      );
      if (remainingSignatures.length > 0) {
        const remainingAfterRefresh =
          await this.postVisibilityVerifier.refreshAndCollectRemainingSelectedItems();

        if (remainingAfterRefresh.length > 0) {
          this.handlePossibleThrottle(remainingAfterRefresh);
          continue;
        }
      }

      const processed = actionResult.count ?? selection.count;
      this.context.addProcessed(processed);
      this.reduceThrottleCooldownAfterSuccess();
      this.context.info(
        `Processed batch: ${processed} item(s). Total processed: ${this.context.totalProcessed}.`,
      );
    }

    return this.context.totalProcessed;
  }

  private async waitBeforeNextBatchIfThrottled(): Promise<void> {
    const cooldown = this.context.consumeThrottleCooldownWait();

    if (cooldown <= 0) {
      return;
    }

    this.context.warn(
      `Waiting ${this.formatDuration(cooldown)} before the next cleanup batch because Instagram looked throttled.`,
    );
    await this.delay(cooldown);
  }

  private handlePossibleThrottle(remainingSignatures: string[]): void {
    const cooldown = this.context.increaseThrottleCooldown();
    this.context.warn(
      [
        'The same selected items are still visible after a long wait and refresh.',
        'Instagram may be throttling this account or the click delay may be too fast.',
        `Try a slower --click-delay if this repeats. Next retry waits ${this.formatDuration(cooldown)}.`,
        `Still visible item signatures: ${remainingSignatures.slice(0, 5).join(', ')}`,
      ].join(' '),
    );
  }

  private reduceThrottleCooldownAfterSuccess(): void {
    const previousCooldown = this.context.currentThrottleCooldownMs;

    if (previousCooldown <= 0) {
      return;
    }

    const nextCooldown = this.context.reduceThrottleCooldownAfterSuccess();
    if (nextCooldown > 0) {
      this.context.info(
        `Cleanup worked after throttling. Next batch cooldown reduced to ${this.formatDuration(nextCooldown)}.`,
      );
      return;
    }

    this.context.info('Cleanup worked after throttling. Batch cooldown cleared.');
  }

  private formatDuration(durationMs: number): string {
    const seconds = Math.ceil(durationMs / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (remainingSeconds === 0) {
      return `${minutes}min`;
    }

    return `${minutes}min ${remainingSeconds}s`;
  }

  private delay(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      globalThis.setTimeout(resolve, durationMs);
    });
  }
}
