export function hasVisibleInput(): boolean {
  class VisibleInputDetector {
    public hasVisibleInput(): boolean {
      return Array.from(document.querySelectorAll('input')).some((input) => this.isVisible(input));
    }

    private isVisible(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
    }
  }

  return new VisibleInputDetector().hasVisibleInput();
}
