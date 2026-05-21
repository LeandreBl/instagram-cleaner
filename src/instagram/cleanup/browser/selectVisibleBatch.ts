import type { SelectionResult } from '../types.js';

export interface SelectionTarget {
  key: string;
}

export interface SelectVisibleBatchInput {
  checkboxSelector: string;
  controlText: string[];
  ignoredKeys?: string[];
}

export interface SelectionTargetInput {
  checkboxSelector: string;
  controlText?: string[];
  key: string;
}

export interface SelectionResultInput {
  attemptedCount: number;
  checkboxSelector: string;
}

export function collectNextVisibleBatchTarget({
  checkboxSelector,
  controlText,
  ignoredKeys = [],
}: SelectVisibleBatchInput): SelectionTarget | null {
  class VisibleBatchTargetCollector {
    private readonly ignored = new Set(ignoredKeys);

    public collect(): SelectionTarget | null {
      const candidate = this.findCandidates()[0];

      if (!candidate) {
        return null;
      }

      return { key: this.getCandidateKey(candidate) };
    }

    private findCandidates(): Element[] {
      const sortedCandidates = Array.from(document.querySelectorAll(checkboxSelector))
        .filter((element) => this.isSelectableCandidate(element))
        .sort((firstElement, secondElement) => this.comparePosition(firstElement, secondElement));

      return this.uniqueByItem(sortedCandidates);
    }

    private isSelectableCandidate(element: Element): boolean {
      return (
        !this.ignored.has(this.getCandidateKey(element)) &&
        this.isVisible(element) &&
        this.isInMainViewport(element) &&
        this.isCheckboxCandidate(element) &&
        !this.isNavigationCandidate(element) &&
        !this.isControl(element) &&
        !this.isChecked(element)
      );
    }

    private isVisible(element: Element): boolean {
      if (element.closest('[aria-hidden="true"]')) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width >= 8 &&
        rect.height >= 8 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      );
    }

    private isInMainViewport(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      return (
        rect.top > 90 &&
        rect.bottom < window.innerHeight - 20 &&
        rect.left > 0 &&
        rect.right < window.innerWidth
      );
    }

    private isControl(element: Element): boolean {
      const text = this.normalize(element.textContent || element.getAttribute('aria-label') || '');
      return controlText.some((word) => word && text.includes(word));
    }

    private isNavigationCandidate(element: Element): boolean {
      const link = element.closest('a[href]');
      const href = link?.getAttribute('href') ?? '';
      return (
        href.includes('facebook.com/help') ||
        href.includes('/help/') ||
        href.includes('/web/lite') ||
        href.includes('/p/') ||
        href.includes('/reel/')
      );
    }

    private isCheckboxCandidate(element: Element): boolean {
      if (element instanceof HTMLInputElement) {
        return element.type === 'checkbox' && !element.checked;
      }

      if (!this.looksLikeCheckboxControl(element)) {
        return false;
      }

      const ariaLabel = this.normalize(element.getAttribute('aria-label'));
      const role = this.normalize(element.getAttribute('role'));
      const testId = this.normalize(element.getAttribute('data-testid'));

      return (
        testId === 'bulk_action_checkbox' ||
        ariaLabel.includes('toggle checkbox') ||
        ariaLabel.includes('checkbox') ||
        role === 'checkbox' ||
        element.hasAttribute('aria-checked')
      );
    }

    private looksLikeCheckboxControl(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const longestSide = Math.max(rect.width, rect.height);
      const shortestSide = Math.min(rect.width, rect.height);

      if (longestSide > 96) {
        return false;
      }

      return shortestSide >= 8 && longestSide / shortestSide <= 3;
    }

    private isChecked(element: Element): boolean {
      if (element instanceof HTMLInputElement) {
        return element.checked;
      }
      if (element.getAttribute('aria-checked') === 'true') {
        return true;
      }

      const icon = element.querySelector('[data-bloks-name="ig.components.Icon"], img, svg');
      if (!icon) {
        return false;
      }

      const style = window.getComputedStyle(icon);
      const mask = style.maskImage || style.webkitMaskImage || '';
      const resourceName = icon.getAttribute('resource_name') ?? '';
      const source = icon.getAttribute('src') ?? icon.getAttribute('href') ?? '';
      return [mask, resourceName, source].some((value) =>
        this.normalize(value).includes('circle-check'),
      );
    }

    private uniqueByItem(elements: Element[]): Element[] {
      const seen = new Set<string>();

      return elements.filter((element) => {
        const key = this.getCandidateKey(element);
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
    }

    private getCandidateKey(element: Element): string {
      const signature = this.getItemSignature(element);
      if (signature) {
        return `item:${signature}`;
      }

      const rect = element.getBoundingClientRect();
      const centerX = Math.round((rect.left + rect.width / 2) / 16);
      const centerY = Math.round((rect.top + rect.height / 2) / 16);
      return `point:${centerX}:${centerY}`;
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
      const text = this.normalize(
        element.closest('div')?.textContent ?? element.textContent ?? '',
      ).slice(0, 80);

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

    private comparePosition(firstElement: Element, secondElement: Element): number {
      const first = firstElement.getBoundingClientRect();
      const second = secondElement.getBoundingClientRect();
      return first.top - second.top || first.left - second.left;
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
  }

  return new VisibleBatchTargetCollector().collect();
}

export function clickSelectionTargetByKey({
  checkboxSelector,
  controlText = [],
  key,
}: SelectionTargetInput): boolean {
  class SelectionTargetClicker {
    public click(): boolean {
      const element = this.findElementByKey();

      if (!element) {
        return false;
      }

      const clickableElement = this.findClickableCheckboxElement(element);

      if (!clickableElement) {
        return false;
      }

      clickableElement.click();
      return true;
    }

    private findElementByKey(): Element | null {
      return (
        Array.from(document.querySelectorAll(checkboxSelector))
          .filter((element) => !this.isControl(element))
          .filter((element) => !this.isNavigationCandidate(element))
          .find((element) => this.getCandidateKey(element) === key) ?? null
      );
    }

    private findClickableCheckboxElement(element: Element): HTMLElement | null {
      const candidates = [
        element,
        ...Array.from(element.querySelectorAll<HTMLElement>(checkboxSelector)),
      ]
        .filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement)
        .filter((candidate) => this.isVisible(candidate))
        .filter((candidate) => this.isCheckboxCandidate(candidate))
        .filter((candidate) => !this.isControl(candidate))
        .filter((candidate) => !this.isNavigationCandidate(candidate))
        .filter((candidate) => !this.isChecked(candidate))
        .sort((first, second) => this.checkboxScore(first) - this.checkboxScore(second));

      return candidates[0] ?? null;
    }

    private isVisible(element: Element): boolean {
      if (element.closest('[aria-hidden="true"]')) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width >= 8 &&
        rect.height >= 8 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      );
    }

    private isCheckboxCandidate(element: Element): boolean {
      if (element instanceof HTMLInputElement) {
        return element.type === 'checkbox' && !element.checked;
      }

      if (!this.looksLikeCheckboxControl(element)) {
        return false;
      }

      const ariaLabel = this.normalize(element.getAttribute('aria-label'));
      const role = this.normalize(element.getAttribute('role'));
      const testId = this.normalize(element.getAttribute('data-testid'));

      return (
        testId === 'bulk_action_checkbox' ||
        ariaLabel.includes('toggle checkbox') ||
        ariaLabel.includes('checkbox') ||
        role === 'checkbox' ||
        element.hasAttribute('aria-checked')
      );
    }

    private isControl(element: Element): boolean {
      const text = this.normalize(element.textContent || element.getAttribute('aria-label') || '');
      return controlText.some((word) => word && text.includes(word));
    }

    private isNavigationCandidate(element: Element): boolean {
      const link = element.closest('a[href]');
      const href = link?.getAttribute('href') ?? '';
      return (
        href.includes('facebook.com/help') ||
        href.includes('/help/') ||
        href.includes('/web/lite') ||
        href.includes('/p/') ||
        href.includes('/reel/')
      );
    }

    private looksLikeCheckboxControl(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const longestSide = Math.max(rect.width, rect.height);
      const shortestSide = Math.min(rect.width, rect.height);

      if (longestSide > 96) {
        return false;
      }

      return shortestSide >= 8 && longestSide / shortestSide <= 3;
    }

    private checkboxScore(element: Element): number {
      const rect = element.getBoundingClientRect();
      const testId = this.normalize(element.getAttribute('data-testid'));
      const role = this.normalize(element.getAttribute('role'));
      const exactMatchBonus =
        testId === 'bulk_action_checkbox' || role === 'checkbox' ? -10_000 : 0;

      return exactMatchBonus + rect.width * rect.height;
    }

    private isChecked(element: Element): boolean {
      if (element instanceof HTMLInputElement) {
        return element.checked;
      }
      if (element.getAttribute('aria-checked') === 'true') {
        return true;
      }

      const icon = element.querySelector('[data-bloks-name="ig.components.Icon"], img, svg');
      if (!icon) {
        return false;
      }

      const style = window.getComputedStyle(icon);
      const mask = style.maskImage || style.webkitMaskImage || '';
      const resourceName = icon.getAttribute('resource_name') ?? '';
      const source = icon.getAttribute('src') ?? icon.getAttribute('href') ?? '';
      return [mask, resourceName, source].some((value) =>
        this.normalize(value).includes('circle-check'),
      );
    }

    private uniqueByItem(elements: Element[]): Element[] {
      const seen = new Set<string>();

      return elements.filter((element) => {
        const key = this.getCandidateKey(element);
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
    }

    private getCandidateKey(element: Element): string {
      const signature = this.getItemSignature(element);
      if (signature) {
        return `item:${signature}`;
      }

      const rect = element.getBoundingClientRect();
      const centerX = Math.round((rect.left + rect.width / 2) / 16);
      const centerY = Math.round((rect.top + rect.height / 2) / 16);
      return `point:${centerX}:${centerY}`;
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
      const text = this.normalize(
        element.closest('div')?.textContent ?? element.textContent ?? '',
      ).slice(0, 80);

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

    private comparePosition(firstElement: Element, secondElement: Element): number {
      const first = firstElement.getBoundingClientRect();
      const second = secondElement.getBoundingClientRect();
      return first.top - second.top || first.left - second.left;
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
  }

  return new SelectionTargetClicker().click();
}

export function isSelectionTargetChecked({
  checkboxSelector,
  controlText = [],
  key,
}: SelectionTargetInput): boolean {
  class SelectionTargetCheck {
    public isChecked(): boolean {
      const element = this.findElementByKey();
      return Boolean(element && this.isElementChecked(element));
    }

    private findElementByKey(): Element | null {
      return (
        Array.from(document.querySelectorAll(checkboxSelector))
          .filter((element) => !this.isControl(element))
          .filter((element) => !this.isNavigationCandidate(element))
          .find((element) => this.getCandidateKey(element) === key) ?? null
      );
    }

    private isElementChecked(element: Element): boolean {
      if (element instanceof HTMLInputElement) {
        return element.checked;
      }
      if (element.getAttribute('aria-checked') === 'true') {
        return true;
      }

      const icon = element.querySelector('[data-bloks-name="ig.components.Icon"], img, svg');
      if (!icon) {
        return false;
      }

      const style = window.getComputedStyle(icon);
      const mask = style.maskImage || style.webkitMaskImage || '';
      const resourceName = icon.getAttribute('resource_name') ?? '';
      const source = icon.getAttribute('src') ?? icon.getAttribute('href') ?? '';
      return [mask, resourceName, source].some((value) =>
        this.normalize(value).includes('circle-check'),
      );
    }

    private isControl(element: Element): boolean {
      const text = this.normalize(element.textContent || element.getAttribute('aria-label') || '');
      return controlText.some((word) => word && text.includes(word));
    }

    private isNavigationCandidate(element: Element): boolean {
      const link = element.closest('a[href]');
      const href = link?.getAttribute('href') ?? '';
      return (
        href.includes('facebook.com/help') ||
        href.includes('/help/') ||
        href.includes('/web/lite') ||
        href.includes('/p/') ||
        href.includes('/reel/')
      );
    }

    private getCandidateKey(element: Element): string {
      const signature = this.getItemSignature(element);
      if (signature) {
        return `item:${signature}`;
      }

      const rect = element.getBoundingClientRect();
      const centerX = Math.round((rect.left + rect.width / 2) / 16);
      const centerY = Math.round((rect.top + rect.height / 2) / 16);
      return `point:${centerX}:${centerY}`;
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
      const text = this.normalize(
        element.closest('div')?.textContent ?? element.textContent ?? '',
      ).slice(0, 80);

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

    private normalize(value: unknown): string {
      return String(value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’‘`]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }
  }

  return new SelectionTargetCheck().isChecked();
}

export function collectSelectionResult({
  attemptedCount,
  checkboxSelector,
}: SelectionResultInput): SelectionResult {
  class SelectionResultCollector {
    public collect(): SelectionResult {
      const selectedSignatures = this.collectSelectedSignatures();
      const confirmedCount = this.readSelectedCount();
      const checkedCount = selectedSignatures.length;
      const effectiveCount = confirmedCount ?? (checkedCount || attemptedCount);

      return {
        count: effectiveCount,
        confirmedCount,
        attemptedCount,
        signatures: selectedSignatures.slice(0, effectiveCount),
      };
    }

    private collectSelectedSignatures(): string[] {
      return Array.from(
        new Set(
          Array.from(document.querySelectorAll(checkboxSelector))
            .filter((checkbox) => this.isChecked(checkbox))
            .map((checkbox) => this.getItemSignature(checkbox))
            .filter((signature): signature is string => Boolean(signature)),
        ),
      );
    }

    private isChecked(element: Element): boolean {
      if (element instanceof HTMLInputElement) {
        return element.checked;
      }
      if (element.getAttribute('aria-checked') === 'true') {
        return true;
      }

      const icon = element.querySelector('[data-bloks-name="ig.components.Icon"], img, svg');
      if (!icon) {
        return false;
      }

      const style = window.getComputedStyle(icon);
      const mask = style.maskImage || style.webkitMaskImage || '';
      const resourceName = icon.getAttribute('resource_name') ?? '';
      const source = icon.getAttribute('src') ?? icon.getAttribute('href') ?? '';
      return [mask, resourceName, source].some((value) =>
        this.normalize(value).includes('circle-check'),
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
      const text = this.normalize(
        element.closest('div')?.textContent ?? element.textContent ?? '',
      ).slice(0, 80);

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

    private readSelectedCount(): number | null {
      const text = Array.from(document.querySelectorAll('div, span, button'))
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter(Boolean)
        .join(' | ');
      const patterns = [
        /(\d+)\s+selected/i,
        /selected\s+(\d+)/i,
        /(\d+)\s+items?\s+selected/i,
        /sélectionné(?:s)?\s*:?\s*(\d+)/i,
        /(\d+)\s+sélectionné(?:s)?/i,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
          return Number(match[1]);
        }
      }

      return null;
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
  }

  return new SelectionResultCollector().collect();
}
