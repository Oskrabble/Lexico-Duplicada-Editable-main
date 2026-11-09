// Detects whether the app is running on a desktop/laptop (non-touch primary).
// Uses a combination of pointer media query and touch capability check.

export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const hasFinePointer = window.matchMedia?.('(pointer: fine)')?.matches ?? false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // Desktop = fine pointer (mouse) and no touch, or fine pointer with touch but
  // the primary input is mouse (hover: hover).
  const canHover = window.matchMedia?.('(hover: hover)')?.matches ?? false;
  return hasFinePointer && canHover && !hasTouch;
}
