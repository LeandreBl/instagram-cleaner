export function hasVisibleSelectionControl(selector: string): boolean {
  class VisibleSelectionControlDetector {
    public hasVisibleControl(): boolean {
      return Array.from(document.querySelectorAll(selector)).some((element) =>
        this.isVisible(element),
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
  }

  return new VisibleSelectionControlDetector().hasVisibleControl();
}
