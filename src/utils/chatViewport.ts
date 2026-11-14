import { useEffect } from "react";

export function useChatViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const update = () => {
      const focused = document.activeElement;
      const editingChat = focused instanceof HTMLElement &&
        focused.hasAttribute("data-chat-composer");
      const keyboardOpen = editingChat && window.innerHeight - viewport.height > 80 &&
        Math.abs(viewport.scale - 1) < .01;
      root.toggleAttribute("data-chat-keyboard", keyboardOpen);
      if (keyboardOpen) {
        root.style.setProperty("--kaps-chat-height", `${Math.round(viewport.height)}px`);
        root.style.setProperty("--kaps-chat-top", `${Math.round(viewport.offsetTop)}px`);
      }
    };
    let frame = 0;
    const afterFocusChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", afterFocusChange);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      cancelAnimationFrame(frame);
      root.removeAttribute("data-chat-keyboard");
      root.style.removeProperty("--kaps-chat-height");
      root.style.removeProperty("--kaps-chat-top");
    };
  }, []);
}
