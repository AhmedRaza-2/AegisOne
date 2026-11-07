/**
 * setInterval that skips its work while the browser tab is hidden (resumes at the next tick when the tab is visible again).
 * Returns the real interval id, so clearInterval(id) works as usual. Saves API calls and CPU for every background tab.
 */
export function visibleInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
  return setInterval(() => { if (typeof document === 'undefined' || !document.hidden) fn(); }, ms);
}
