export function resolveMobileShellHeight(input: {
  visibleHeight: number;
  innerHeight: number;
  screenHeight: number;
  unobscuredHeight: number;
  editing: boolean;
  iosStandalone: boolean;
}) {
  const keyboardOpen = input.editing && input.unobscuredHeight - input.visibleHeight > 60;
  const standaloneHeight = input.iosStandalone && input.screenHeight > input.innerHeight &&
    input.screenHeight - input.innerHeight < 120 ? input.screenHeight : input.innerHeight;
  return { keyboardOpen, shellHeight: keyboardOpen ? input.visibleHeight : standaloneHeight };
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
    const iosStandalone = /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      ((navigator as Navigator & { standalone?: boolean }).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches);
    // iOS standalone can reserve a strip below the CSS viewport. Fill that strip
    // with the app shell; its bottom dock is positioned inside the shell.
    const { keyboardOpen, shellHeight } = resolveMobileShellHeight({
      visibleHeight: height, innerHeight: window.innerHeight,
      screenHeight: screen.height, unobscuredHeight, editing, iosStandalone
    });
    root.style.setProperty('--app-shell-height', `${shellHeight}px`);
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
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  update();
  return () => {
    cancelAnimationFrame(frame);
    window.history.pushState = origPushState;
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('focusin', schedule);
    document.removeEventListener('focusout', schedule);
    root.style.removeProperty('--visible-height');
    root.style.removeProperty('--app-shell-height');
    root.style.removeProperty('--visible-top');
    delete root.dataset.keyboardOpen;
  };
}
