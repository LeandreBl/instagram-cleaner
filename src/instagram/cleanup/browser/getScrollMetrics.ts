export interface BrowserScrollMetrics {
  target: string;
  position: number;
  height: number;
}

export function getScrollMetrics(): BrowserScrollMetrics {
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

  function describeScrollTarget(candidate: HTMLElement): string {
    return [
      candidate.tagName.toLowerCase(),
      candidate.id ? `#${candidate.id}` : '',
      candidate.getAttribute('role') ? `[role="${candidate.getAttribute('role')}"]` : '',
    ].join('');
  }

  const element = findCentralScrollableElement();

  if (element) {
    return {
      target: describeScrollTarget(element),
      position: element.scrollTop,
      height: element.scrollHeight,
    };
  }

  return {
    target: 'window',
    position: window.scrollY,
    height: document.body.scrollHeight,
  };
}
