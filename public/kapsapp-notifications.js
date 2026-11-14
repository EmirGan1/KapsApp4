self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));

self.addEventListener("push", event => {
  event.waitUntil((async () => {
    if (!event.data) return;
    const alert = event.data.json();
    if (!alert.title || !alert.expiresAt || alert.expiresAt <= Date.now()) return;
    const isIncomingCall = String(alert.tag || "").startsWith("call_");

    if (isIncomingCall) {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({ type: "kaps:incoming_call_push", alert });
      }
      const visibleClient = windows.find(client => client.visibilityState === "visible");
      if (visibleClient) {
        // App or standalone PWA is already open on screen: show full-screen native call UI instead of a notification banner
        return;
      }
    }

    let icon = "/brand/kapsapp-mark.png";
    if (alert.avatar) {
      try {
        const avatar = new URL(alert.avatar, self.location.origin);
        if (avatar.origin === self.location.origin) icon = avatar.href;
      } catch {}
    }
    await self.registration.showNotification(alert.title, {
      body: alert.body,
      icon,
      tag: "kapsapp-notification-" + alert.tag,
      requireInteraction: isIncomingCall,
      data: { url: alert.url, isIncomingCall, alert },
    });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || "/", self.location.origin);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const page = windows.find(client => client.visibilityState === "visible") || windows[0];
    if (!page) return self.clients.openWindow(target.href);
    if (event.notification.data?.isIncomingCall) {
      page.postMessage({ type: "kaps:incoming_call_push", alert: event.notification.data?.alert });
      return page.focus();
    }
    if (event.notification.data?.url && page.url !== target.href) {
      const navigated = await page.navigate(target.href);
      return navigated?.focus();
    }
    return page.focus();
  })());
});

