import type { ClickPoint } from '../clickByLabels.js';

export interface LabelMatchInput {
  labelsToFind: string[];
  shouldMatchExactly: boolean;
  shouldPreferLast: boolean;
  shouldIncludeInputs: boolean;
  shouldIncludeTextElements: boolean;
  shouldMatchInsideDialog: boolean;
}

export function findMatchingLabel({
  labelsToFind,
  shouldMatchExactly,
  shouldPreferLast,
  shouldIncludeInputs,
  shouldIncludeTextElements,
  shouldMatchInsideDialog,
}: LabelMatchInput): ClickPoint | null {
  class LabelMatcher {
    public find(): ClickPoint | null {
      const matches = this.findCandidates().filter(({ text }) =>
        labelsToFind.some((label) => (shouldMatchExactly ? text === label : text.includes(label))),
      );
      const chosen = shouldPreferLast ? matches.at(-1) : matches[0];
      if (!chosen) {
        return null;
      }

      this.clickElement(chosen.element);

      const rect = chosen.element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        text: chosen.text,
      };
    }

    private clickElement(element: Element): void {
      if (element instanceof HTMLElement) {
        element.click();
        return;
      }

      element.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
      );
    }

    private findCandidates(): Array<{ element: Element; text: string; rect: DOMRect }> {
      return Array.from(this.searchRoot().querySelectorAll(this.selector()))
        .filter((element) => this.isVisible(element))
        .map((element) => this.toCandidate(element))
        .filter(({ text, rect }) => text && rect.width > 0 && rect.height > 0);
    }

    private searchRoot(): ParentNode {
      if (!shouldMatchInsideDialog) {
        return document;
      }

      return this.findTopVisibleDialog() ?? document.createDocumentFragment();
    }

    private findTopVisibleDialog(): Element | null {
      const dialogs = Array.from(
        document.querySelectorAll('[role="dialog"], [aria-modal="true"]'),
      ).filter((element) => this.isVisible(element));

      return dialogs.at(-1) ?? null;
    }

    private toCandidate(element: Element): { element: Element; text: string; rect: DOMRect } {
      const clickable = element.closest('button,[role="button"],a,[tabindex="0"],input') ?? element;
      const text = this.normalize(this.textOf(element) || this.textOf(clickable));
      const rect = clickable.getBoundingClientRect();

      return { element: clickable, text, rect };
    }

    private selector(): string {
      return [
        'button',
        '[role="button"]',
        'a',
        '[tabindex="0"]',
        '[aria-label]',
        shouldIncludeInputs ? 'input' : '',
        shouldIncludeTextElements ? 'div' : '',
        shouldIncludeTextElements ? 'span' : '',
      ]
        .filter(Boolean)
        .join(',');
    }

    private isVisible(element: Element): boolean {
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
    }

    private textOf(element: Element): string {
      if (element instanceof HTMLInputElement) {
        return element.value || element.getAttribute('aria-label') || element.placeholder || '';
      }

      if (element instanceof HTMLElement) {
        return (
          element.innerText ||
          element.textContent ||
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          ''
        );
      }

      return (
        element.textContent ||
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        ''
      );
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

  return new LabelMatcher().find();
}
