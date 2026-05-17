/**
 * @fileoverview Small DOM helpers for the messaging smart-auto-scroll
 * pattern. Kept here so MessageList stays focused on rendering.
 */

/**
 * Walk up from `el` to the first ancestor whose computed
 * `overflow-y` is `auto` or `scroll`. Returns null if none is found.
 *
 * Used by MessageList to find its scroll container without forcing
 * MessageView to lift the container ref down via a prop (which would
 * couple the two more tightly than necessary for this one feature).
 */
export function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  let cur: HTMLElement | null = el.parentElement;
  while (cur) {
    const style = getComputedStyle(cur);
    if (/(auto|scroll)/.test(style.overflowY)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Whether a scrollable element is within `thresholdPx` of its
 * bottom. The threshold is generous (default 150px) so a user
 * scrolled one bubble up still counts as "tracking the
 * conversation" — too tight a threshold would make the chat feel
 * twitchy.
 */
export function isNearBottom(el: HTMLElement, thresholdPx = 150): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < thresholdPx;
}
