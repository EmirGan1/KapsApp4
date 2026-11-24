export function resolveMobileShellHeight(input: {
  visibleHeight: number;
  innerHeight: number;
  unobscuredHeight: number;
  editing: boolean;
}) {
  const keyboardOpen = input.editing && input.unobscuredHeight - input.visibleHeight > 60;
  // iOS can retain a shorter visualViewport after the keyboard/browser UI closes.
  // Only the keyboard may override CSS viewport sizing. Otherwise use 100dvh.
  return { keyboardOpen, shellHeight: keyboardOpen ? input.visibleHeight : null };
}

/** Use the visible viewport when a software keyboard covers the layout viewport. */
export function installMobileViewport() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  let frame = 0;
  let unobscuredHeight = window.innerHeight;
  const update = () => {
    frame = 0;
    // Do not fight accessibility pinch zoom by resizing the application underneath it.
    if (viewport && viewport.scale !== 1) return;
    const height = viewport?.height ?? window.innerHeight;
    const active = document.activeElement;
    const editing = active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]');
    if (!editing) unobscuredHeight = window.innerHeight;
    const { keyboardOpen, shellHeight } = resolveMobileShellHeight({
      visibleHeight: height, innerHeight: window.innerHeight,
      unobscuredHeight, editing
    });
    if (shellHeight !== null) {
      root.style.setProperty('--app-shell-height', `${shellHeight}px`);
      root.style.setProperty('--app-shell-top', `${viewport?.offsetTop ?? 0}px`);
    } else {
      root.style.removeProperty('--app-shell-height');
      root.style.removeProperty('--app-shell-top');
    }
    root.style.setProperty('--visible-height', `${height}px`);
    root.style.setProperty('--visible-top', `${viewport?.offsetTop ?? 0}px`);
    root.dataset.keyboardOpen = String(keyboardOpen);
  };
  const origPushState = window.history.pushState.bind(window.history);
  const origReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = function (data: any, unused: string, url?: string | URL | null) {
    if (url && !(data && typeof data === 'object' && 'kapsChatOpen' in data)) {
      try {
        const resolved = new URL(String(url), window.location.href);
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        const targetPath = resolved.pathname + resolved.search + resolved.hash;
        if (targetPath === currentPath) {
          return origReplaceState(data, unused, url);
        }
      } catch {}
    }
    return origPushState(data, unused, url);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('orientationchange', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  update();
  return () => {
    cancelAnimationFrame(frame);
    window.history.pushState = origPushState;
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('orientationchange', schedule);
    document.removeEventListener('focusin', schedule);
    document.removeEventListener('focusout', schedule);
    root.style.removeProperty('--visible-height');
    root.style.removeProperty('--app-shell-height');
    root.style.removeProperty('--visible-top');
    root.style.removeProperty('--app-shell-top');
    delete root.dataset.keyboardOpen;
  };
}
