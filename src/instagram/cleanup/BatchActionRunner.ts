import { waitForDomReady, waitForPageIdle } from '../../browser/waits.js';
import { clickByLabels } from '../clickByLabels.js';
import type { CleanupContext } from './CleanupContext.js';
import { NetworkVerifier } from './NetworkVerifier.js';
import { ToastVerifier } from './ToastVerifier.js';

const baseToastTimeout = 12_000;
const toastTimeoutPerSelectedItem = 350;
const maxToastTimeout = 90_000;
const confirmationDialogCloseTimeoutMs = 15_000;
const errorDialogRecoveryTimeoutMs = 120_000;
const postToastTimeoutErrorDialogCheckMs = 30_000;

export type BatchActionResult =
  | { status: 'confirmed'; count: number | null }
  | { status: 'recovered-error-dialog' };

export class BatchActionRunner {
  private readonly networkVerifier: NetworkVerifier;
  private readonly toastVerifier: ToastVerifier;

  public constructor(private readonly context: CleanupContext) {
    this.networkVerifier = new NetworkVerifier(context);
    this.toastVerifier = new ToastVerifier(context);
  }

  public async run(): Promise<BatchActionResult> {
    const previousToasts = await this.toastVerifier.collectExistingTexts();
    const mutationRequest = this.networkVerifier.waitForMutation();
    const toastRequest = this.toastVerifier.waitForNewToast(previousToasts, this.getToastTimeout());

    const actionClicked = await clickByLabels(this.context.page, this.context.target.actionLabels, {
      timeout: 6000,
      preferLast: true,
      debugName: this.context.target.actionLabels.join(' / '),
    });

    if (!actionClicked) {
      throw new Error('The cleanup action button was not found. No manual fallback was attempted.');
    }

    const confirmed = await clickByLabels(this.context.page, this.context.target.confirmLabels, {
      timeout: 8000,
      preferLast: true,
      insideDialog: true,
      debugName: `Confirmation ${this.context.target.confirmLabels.join(' / ')}`,
    });

    if (!confirmed) {
      throw new Error(
        'The cleanup confirmation button was not found. No manual fallback was attempted.',
      );
    }

    await this.waitForConfirmationDialogToClose();

    const actionResult = await Promise.race([
      toastRequest.then((toastResult) => ({ type: 'toast' as const, toastResult })),
      this.waitForInstagramErrorDialog(errorDialogRecoveryTimeoutMs).then((found) => ({
        type: 'error-dialog' as const,
        found,
      })),
    ]);

    if (actionResult.type === 'error-dialog' && actionResult.found) {
      await this.recoverFromInstagramErrorDialog();
      return { status: 'recovered-error-dialog' };
    }

    const toastResult = actionResult.type === 'toast' ? actionResult.toastResult : null;
    if (toastResult) {
      this.context.debug(`Instagram confirmed cleanup: ${toastResult.text}`);
    } else {
      this.context.warn('No Instagram cleanup toast was detected after confirmation.');
      if (await this.waitForInstagramErrorDialog(postToastTimeoutErrorDialogCheckMs)) {
        await this.recoverFromInstagramErrorDialog();
        return { status: 'recovered-error-dialog' };
      }

      this.networkVerifier.ensureMutationSucceeded(await mutationRequest);
    }

    await waitForPageIdle(this.context.page, 8_000, 750);
    return { status: 'confirmed', count: toastResult?.count ?? null };
  }

  private getToastTimeout(): number {
    return Math.min(
      maxToastTimeout,
      baseToastTimeout + this.context.currentSelection.count * toastTimeoutPerSelectedItem,
    );
  }

  private async waitForConfirmationDialogToClose(): Promise<void> {
    const labels = this.context.target.confirmLabels.map((label) => this.normalize(label));

    try {
      await this.context.page.waitForFunction(
        (confirmationLabels: string[]) => {
          const normalize = (value: unknown): string =>
            String(value ?? '')
              .normalize('NFKD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[’‘`]/g, "'")
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
          const isVisible = (element: Element): boolean => {
            if (element.closest('[aria-hidden="true"]')) {
              return false;
            }

            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none'
            );
          };
          const dialogs = Array.from(
            document.querySelectorAll('[role="dialog"], [aria-modal="true"]'),
          ).filter((element) => isVisible(element));

          return !dialogs.some((dialog) => {
            const text = normalize(dialog.textContent ?? '');
            return confirmationLabels.some((label) => label && text.includes(label));
          });
        },
        { timeout: confirmationDialogCloseTimeoutMs, polling: 250 },
        labels,
      );
    } catch {
      throw new Error('The cleanup confirmation dialog stayed open after clicking confirm.');
    }
  }

  private async waitForInstagramErrorDialog(timeout: number): Promise<boolean> {
    return this.context.page
      .waitForFunction(
        () => {
          const normalize = (value: unknown): string =>
            String(value ?? '')
              .normalize('NFKD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[’‘`]/g, "'")
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
          const isVisible = (element: Element): boolean => {
            if (element.closest('[aria-hidden="true"]')) {
              return false;
            }

            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none'
            );
          };
          const errorTexts = [
            "une erreur s'est produite",
            'une erreur est survenue',
            'something went wrong',
            'an error occurred',
            'try again later',
          ];

          return Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]'))
            .filter((element) => isVisible(element))
            .some((dialog) => {
              const text = normalize(dialog.textContent ?? '');
              return errorTexts.some((errorText) => text.includes(errorText));
            });
        },
        { timeout, polling: 250 },
      )
      .then(async (handle) => {
        await handle.dispose();
        return true;
      })
      .catch(() => false);
  }

  private async recoverFromInstagramErrorDialog(): Promise<void> {
    const cooldown = this.context.increaseThrottleCooldown();
    this.context.warn(
      `Instagram displayed an error dialog after cleanup confirmation. Dismissing it and waiting ${this.formatDuration(cooldown)} before refreshing because Instagram looks throttled.`,
    );

    await clickByLabels(this.context.page, ['OK', 'Ok', "D'accord", 'D’accord'], {
      timeout: 5_000,
      exact: true,
      insideDialog: true,
      debugName: 'Instagram error dialog OK',
    });

    await this.delay(this.context.consumeThrottleCooldownWait());

    try {
      await this.context.page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    } catch (error) {
      this.context.warn(
        `Page refresh did not settle cleanly: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.context.page.goto(this.context.target.url, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
    }

    await waitForDomReady(this.context.page, 90_000);
    await waitForPageIdle(this.context.page, 30_000, 1_500);
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

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘`]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private delay(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      globalThis.setTimeout(resolve, durationMs);
    });
  }
}
