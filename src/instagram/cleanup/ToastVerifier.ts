import type { CleanupContext } from './CleanupContext.js';
import { collectExistingCleanupToasts } from './browser/collectExistingCleanupToasts.js';
import { findNewCleanupToast } from './browser/findNewCleanupToast.js';
import type { CleanupToastResult } from './types.js';
import { getTranslationValues } from '../../translations/loadTranslations.js';
import type { CleanupMode } from '../../types.js';

const cleanupToastTranslationKeys: Record<CleanupMode, string[]> = {
  likes: ['likesCleanupToast'],
  comments: ['commentsCleanupToast'],
};

export class ToastVerifier {
  public constructor(private readonly context: CleanupContext) {}

  public async collectExistingTexts(): Promise<string[]> {
    return this.context.page.evaluate(collectExistingCleanupToasts, {
      templates: this.toastTemplates,
    });
  }

  public async waitForNewToast(
    ignoredTexts: string[],
    timeout = 12_000,
  ): Promise<CleanupToastResult | null> {
    try {
      const handle = await this.waitForToastHandle(ignoredTexts, timeout);
      const result = await handle.jsonValue();
      await handle.dispose();
      this.context.lastToast = result;
      return result;
    } catch {
      return null;
    }
  }

  private async waitForToastHandle(ignoredTexts: string[], timeout: number) {
    return this.context.page.waitForFunction(
      findNewCleanupToast,
      { timeout, polling: 100 },
      { ignored: ignoredTexts, templates: this.toastTemplates },
    );
  }

  private get toastTemplates(): string[] {
    return getTranslationValues(
      this.context.translations,
      cleanupToastTranslationKeys[this.context.target.mode],
    );
  }
}
