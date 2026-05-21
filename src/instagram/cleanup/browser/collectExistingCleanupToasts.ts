export interface CollectExistingCleanupToastsInput {
  templates: string[];
}

export function collectExistingCleanupToasts({
  templates,
}: CollectExistingCleanupToastsInput): string[] {
  class ExistingCleanupToastCollector {
    private readonly patterns = templates.map((template) => this.createToastPattern(template));

    public collect(): string[] {
      return Array.from(document.querySelectorAll('div, span'))
        .filter((element) => this.isVisible(element))
        .map((element) => this.parseToastText(element.textContent ?? ''))
        .filter((text): text is string => Boolean(text));
    }

    private isVisible(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
    }

    private parseToastText(text: string): string | null {
      const normalized = text.replace(/\s+/g, ' ').trim();

      for (const pattern of this.patterns) {
        const match = normalized.match(pattern);
        if (match?.[0]) {
          return match[0];
        }
      }

      return null;
    }

    private createToastPattern(template: string): RegExp {
      const normalizedTemplate = template.replace(/\s+/g, ' ').trim();
      const escapedParts = normalizedTemplate
        .split(/\{\{\s*count\s*\}\}/i)
        .map((part) => this.escapeRegExp(part).replace(/\s+/g, '\\s+'));

      return new RegExp(`${escapedParts.join('[\\d,.\\s]+')}(?:\\.|(?=\\s|$))`, 'i');
    }

    private escapeRegExp(value: string): string {
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }

  return new ExistingCleanupToastCollector().collect();
}
