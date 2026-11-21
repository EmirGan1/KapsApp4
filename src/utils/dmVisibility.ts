export function isDmForeground() {
  return document.visibilityState === 'visible' && document.hasFocus();
}
