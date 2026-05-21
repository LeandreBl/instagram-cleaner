export interface SelectedItemsDisappearedInput {
  previousSignatures: string[];
  selector: string;
}

export function haveSelectedItemsDisappeared({
  previousSignatures,
  selector,
}: SelectedItemsDisappearedInput): boolean {
  class SelectedItemsDisappearanceCheck {
    public constructor(private readonly previous: string[]) {}

    public hasDisappeared(): boolean {
      const currentSignatures = this.collectVisibleSignatures();
      return !this.previous.some((signature) => currentSignatures.includes(signature));
    }

    private collectVisibleSignatures(): string[] {
      return Array.from(
        new Set(
          Array.from(document.querySelectorAll(selector))
            .filter((element) => this.isVisible(element))
            .map((element) => this.getItemSignature(element))
            .filter((signature): signature is string => Boolean(signature)),
        ),
      );
    }

    private isVisible(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width >= 8 &&
        rect.height >= 8 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      );
    }

    private getItemSignature(element: Element): string | null {
      let current: Element | null = element;

      for (let depth = 0; current && depth < 12; depth += 1) {
        const directMediaId =
          current.getAttribute('media_id') ??
          current.getAttribute('data-media-id') ??
          current.getAttribute('data-id');
        if (directMediaId) {
          return `id:${directMediaId}`;
        }

        const link = current.querySelector<HTMLAnchorElement>('a[href*="/p/"], a[href*="/reel/"]');
        if (link?.href) {
          const stable = this.stableUrlPart(link.href);
          if (stable) {
            return `href:${stable}`;
          }
        }

        const image = current.querySelector<HTMLImageElement>('img[src], img[currentSrc]');
        const imageSource = image?.currentSrc || image?.src || '';
        if (imageSource && !this.isProfileAvatarUrl(imageSource)) {
          const stable = this.stableUrlPart(imageSource);
          if (stable) {
            return `image:${stable}`;
          }
        }

        current = current.parentElement;
      }

      return this.textPositionSignature(element);
    }

    private isProfileAvatarUrl(value: string): boolean {
      return /\/t51\.[^/]+-19\//.test(value);
    }

    private textPositionSignature(element: Element): string | null {
      const text = (element.closest('div')?.textContent ?? element.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .slice(0, 80);

      if (!text) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return `text:${text}:${Math.round(rect.top / 8)}:${Math.round(rect.left / 8)}`;
    }

    private stableUrlPart(value: string): string | null {
      if (!value) {
        return null;
      }

      try {
        const url = new URL(value, window.location.origin);
        const cacheKey = url.searchParams.get('ig_cache_key');
        if (cacheKey) {
          return `ig_cache_key:${cacheKey}`;
        }
        return `${url.hostname}${url.pathname}`;
      } catch {
        return value.split('?')[0] ?? null;
      }
    }
  }

  return new SelectedItemsDisappearanceCheck(previousSignatures).hasDisappeared();
}
