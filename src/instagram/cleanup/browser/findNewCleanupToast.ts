import type { CleanupToastResult } from '../types.js';

export interface FindNewCleanupToastInput {
  ignored: string[];
  templates: string[];
}

export function findNewCleanupToast({
  ignored,
  templates,
}: FindNewCleanupToastInput): CleanupToastResult | null {
  class NewCleanupToastFinder {
    private readonly patterns = templates.map((template) => this.createToastPattern(template));

    public find(): CleanupToastResult | null {
      for (const element of Array.from(document.querySelectorAll('div, span'))) {
        if (!this.isVisible(element)) {
          continue;
        }

        const result = this.parseToast(element.textContent ?? '');
        if (result) {
          return result;
        }
      }

      return null;
    }

    private isVisible(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
    }

    private parseToast(text: string): CleanupToastResult | null {
      const normalized = text.replace(/\s+/g, ' ').trim();
      if (!normalized || ignored.includes(normalized)) {
        return null;
      }

      for (const pattern of this.patterns) {
        const match = normalized.match(pattern);
        if (!match?.[1]) {
          continue;
        }

        const toastText = match[0];
        if (ignored.includes(toastText)) {
          return null;
        }

        return { count: Number(match[1].replace(/\D/g, '')), text: toastText };
      }

      return null;
    }

    private createToastPattern(template: string): RegExp {
      const normalizedTemplate = template.replace(/\s+/g, ' ').trim();
      const escapedParts = normalizedTemplate
        .split(/\{\{\s*count\s*\}\}/i)
        .map((part) => this.escapeRegExp(part).replace(/\s+/g, '\\s+'));

      return new RegExp(`${escapedParts.join('([\\d,.\\s]+)')}(?:\\.|(?=\\s|$))`, 'i');
    }

    private escapeRegExp(value: string): string {
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }

  return new NewCleanupToastFinder().find();
}
