import { waitForPageIdle } from '../../browser/waits.js';
import type { CleanupContext } from './CleanupContext.js';
import { getScrollMetrics } from './browser/getScrollMetrics.js';
import { hasScrollPositionChanged } from './browser/hasScrollPositionChanged.js';
import { scrollByViewport } from './browser/scrollByViewport.js';
import type { ScrollResult } from './types.js';

export class ScrollManager {
  public constructor(private readonly context: CleanupContext) {}

  public async scrollMore(): Promise<ScrollResult> {
    const beforeScroll = await this.context.page.evaluate(getScrollMetrics);

    await this.context.page.evaluate(scrollByViewport);

    try {
      await this.context.page.waitForFunction(
        hasScrollPositionChanged,
        { timeout: 2_500 },
        beforeScroll,
      );
    } catch {
      // No movement means the page is likely already at the end.
    }

    const afterScroll = await this.context.page.evaluate(getScrollMetrics);

    return {
      before: beforeScroll.position,
      after: afterScroll.position,
      height: afterScroll.height,
    };
  }

  public async waitAfterEmptyPass(): Promise<void> {
    await waitForPageIdle(this.context.page, 4_000, 750);
  }
}
