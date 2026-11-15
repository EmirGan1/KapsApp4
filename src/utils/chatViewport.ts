import { useEffect } from "react";

export function isChatKeyboardOpen(editingChat: boolean, viewportScale: number, sharedKeyboardOpen: boolean, heightDiff: number) {
  return editingChat && Math.abs(viewportScale - 1) < 0.05 && (sharedKeyboardOpen || heightDiff > 60);
}

export function useChatViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const update = () => {
      const focused = document.activeElement;
      const editingChat =
        focused instanceof HTMLElement &&
        (focused.hasAttribute("data-chat-composer") ||
          Boolean(focused.closest(".kaps-chat-composer")));
      const heightDiff = window.innerHeight - viewport.height;
      const keyboardOpen = isChatKeyboardOpen(editingChat, viewport.scale || 1, root.dataset.keyboardOpen === "true", heightDiff);
      root.toggleAttribute("data-chat-keyboard", keyboardOpen);
      if (keyboardOpen) {
        root.style.setProperty("--kaps-chat-height", `${Math.round(viewport.height)}px`);
        root.style.setProperty("--kaps-chat-top", `${Math.round(viewport.offsetTop)}px`);
      } else {
        root.style.removeProperty("--kaps-chat-height");
        root.style.removeProperty("--kaps-chat-top");
      }
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      cancelAnimationFrame(frame);
      root.removeAttribute("data-chat-keyboard");
      root.style.removeProperty("--kaps-chat-height");
      root.style.removeProperty("--kaps-chat-top");
    };
  }, []);
}
