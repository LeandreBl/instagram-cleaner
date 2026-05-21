import type { BrowserScrollMetrics } from './getScrollMetrics.js';

export function hasScrollPositionChanged(previous: BrowserScrollMetrics): boolean {
  function getCurrentScrollMetrics(
    target: string,
  ): Pick<BrowserScrollMetrics, 'position' | 'height'> {
    if (target !== 'window') {
      const element = findCentralScrollableElement();

      if (element) {
        return {
          position: element.scrollTop,
          height: element.scrollHeight,
        };
      }
    }

    return {
      position: window.scrollY,
      height: document.body.scrollHeight,
    };
  }

  function findCentralScrollableElement(): HTMLElement | null {
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('main, [role="main"], div'));

    return (
      elements
        .filter(
          (candidate) =>
            isScrollable(candidate) &&
            containsViewportCenter(candidate, viewportCenterX, viewportCenterY),
        )
        .sort((first, second) => scrollableArea(second) - scrollableArea(first))[0] ?? null
    );
  }

  function isScrollable(candidate: HTMLElement): boolean {
    const style = window.getComputedStyle(candidate);
    const canScroll = /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`);

    return canScroll && candidate.scrollHeight > candidate.clientHeight + 20;
  }

  function containsViewportCenter(
    candidate: HTMLElement,
    centerX: number,
    centerY: number,
  ): boolean {
    const rect = candidate.getBoundingClientRect();

    return (
      rect.left <= centerX && rect.right >= centerX && rect.top <= centerY && rect.bottom >= centerY
    );
  }

  function scrollableArea(candidate: HTMLElement): number {
    const rect = candidate.getBoundingClientRect();
    return rect.width * rect.height;
  }

  const current = getCurrentScrollMetrics(previous.target);

  return current.position !== previous.position || current.height !== previous.height;
}
