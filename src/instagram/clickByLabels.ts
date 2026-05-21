import type { Page } from 'puppeteer';
import { waitForPageIdle } from '../browser/waits.js';
import { logger } from '../utils/logger.js';
import { normalizeText } from '../utils/text.js';
import { findMatchingLabel, type LabelMatchInput } from './browser/findMatchingLabel.js';

export interface ClickByLabelsOptions {
  timeout?: number;
  exact?: boolean;
  preferLast?: boolean;
  includeInputs?: boolean;
  includeTextElements?: boolean;
  insideDialog?: boolean;
  waitAfterClickTimeout?: number;
  waitAfterClickIdleTime?: number;
  debugName?: string;
}

export interface ClickPoint {
  x: number;
  y: number;
  text: string;
}

class LabelClicker {
  public constructor(
    private readonly page: Page,
    private readonly labels: string[],
    private readonly options: Required<ClickByLabelsOptions>,
  ) {}

  public async click(): Promise<boolean> {
    try {
      const match = await this.findMatch();
      if (!match) {
        return false;
      }

      await this.waitAfterClick();
      return true;
    } catch {
      return false;
    }
  }

  private async findMatch(): Promise<ClickPoint | null> {
    const matchHandle = await this.page.waitForFunction(
      findMatchingLabel,
      { timeout: this.options.timeout, polling: 250 },
      this.matchInput(),
    );
    const match = await matchHandle.jsonValue();
    await matchHandle.dispose();
    return match;
  }

  private matchInput(): LabelMatchInput {
    return {
      labelsToFind: this.labels.map(normalizeText).filter(Boolean),
      shouldMatchExactly: this.options.exact,
      shouldPreferLast: this.options.preferLast,
      shouldIncludeInputs: this.options.includeInputs,
      shouldIncludeTextElements: this.options.includeTextElements,
      shouldMatchInsideDialog: this.options.insideDialog,
    };
  }

  private async waitAfterClick(): Promise<void> {
    if (this.options.waitAfterClickTimeout <= 0) {
      return;
    }

    await waitForPageIdle(
      this.page,
      this.options.waitAfterClickTimeout,
      this.options.waitAfterClickIdleTime,
    );
  }
}

export async function clickByLabels(
  page: Page,
  labels: string[],
  options: ClickByLabelsOptions = {},
): Promise<boolean> {
  const resolvedOptions: Required<ClickByLabelsOptions> = {
    timeout: options.timeout ?? 8000,
    exact: options.exact ?? false,
    preferLast: options.preferLast ?? false,
    includeInputs: options.includeInputs ?? true,
    includeTextElements: options.includeTextElements ?? false,
    insideDialog: options.insideDialog ?? false,
    waitAfterClickTimeout: options.waitAfterClickTimeout ?? 2_500,
    waitAfterClickIdleTime: options.waitAfterClickIdleTime ?? 500,
    debugName: options.debugName ?? labels.join(' / '),
  };
  const clicker = new LabelClicker(page, labels, resolvedOptions);

  if (!(await clicker.click())) {
    logger.debug(`Button not found: ${resolvedOptions.debugName}`);
    return false;
  }

  return true;
}
