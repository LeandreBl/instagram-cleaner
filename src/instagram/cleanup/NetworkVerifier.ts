import type { HTTPRequest, HTTPResponse } from 'puppeteer';
import type { CleanupContext } from './CleanupContext.js';
import type { InstagramMutationResult } from './types.js';

export class NetworkVerifier {
  public constructor(private readonly context: CleanupContext) {}

  public waitForMutation(timeout = 20_000): Promise<InstagramMutationResult | null> {
    return this.context.page
      .waitForResponse((candidate) => this.isRelevantMutation(candidate), { timeout })
      .then((response) => {
        const request = response.request();
        const result = {
          method: request.method().toUpperCase(),
          status: response.status(),
          url: response.url(),
        };
        this.context.lastMutation = result;
        return result;
      })
      .catch(() => null);
  }

  public ensureMutationSucceeded(result: InstagramMutationResult | null): void {
    if (!result) {
      this.context.warn(
        'No matching Instagram delete/unlike request was detected after confirmation.',
      );
      return;
    }

    if (result.status < 200 || result.status >= 300) {
      throw new Error(
        `Instagram cleanup request failed with HTTP ${result.status}: ${result.method} ${result.url}`,
      );
    }

    this.context.debug(`Instagram cleanup request succeeded: HTTP ${result.status}`);
  }

  private async isRelevantMutation(response: HTTPResponse): Promise<boolean> {
    const request = response.request();
    const method = request.method().toUpperCase();

    if (!['POST', 'DELETE', 'PATCH'].includes(method)) {
      return false;
    }

    const responseUrl = new URL(response.url());
    if (!responseUrl.hostname.endsWith('instagram.com')) {
      return false;
    }

    const pathname = responseUrl.pathname.toLowerCase();
    const search = responseUrl.search.toLowerCase();
    const appId = responseUrl.searchParams.get('appid')?.toLowerCase() ?? '';
    const requestType = responseUrl.searchParams.get('type')?.toLowerCase() ?? '';
    const payload = await this.getRequestPayload(request);
    const combined = `${pathname} ${search} ${payload}`;
    const isWbloksAction = pathname.includes('/async/wbloks/fetch') && requestType === 'action';

    if (
      ['logging', 'events', 'falco', 'qe/sync', 'batch_fetch'].some((word) =>
        combined.includes(word),
      )
    ) {
      return false;
    }

    if (this.context.target.mode === 'likes') {
      return (
        pathname.includes('/likes/') ||
        combined.includes('unlike') ||
        (isWbloksAction && appId.includes('activity_center.liked_unlike'))
      );
    }

    return (
      (isWbloksAction &&
        appId.includes('activity_center') &&
        appId.includes('comment') &&
        (appId.includes('delete') || appId.includes('remove'))) ||
      (pathname.includes('comment') && (pathname.includes('delete') || method === 'DELETE')) ||
      (payload.includes('comment') && payload.includes('delete'))
    );
  }

  private async getRequestPayload(request: HTTPRequest): Promise<string> {
    if (!request.hasPostData()) {
      return '';
    }
    return ((await request.fetchPostData().catch(() => undefined)) ?? '').toLowerCase();
  }
}
