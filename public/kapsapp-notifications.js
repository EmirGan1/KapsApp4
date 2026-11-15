self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

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
        // App or standalone PWA is already open on screen: full-screen native call UI is already active
        return;
      }
      // Try bringing backgrounded PWA window forward if permitted by the OS/browser
      if (windows[0] && typeof windows[0].focus === "function") {
        try {
          await windows[0].focus();
        } catch {}
      }
    }

    let icon = "/brand/kapsapp-mark.png";
    if (alert.avatar) {
      try {
        const avatar = new URL(alert.avatar, self.location.origin);
        if (avatar.origin === self.location.origin) icon = avatar.href;
      } catch {}
    }

    const notificationOptions = {
      body: alert.body,
      icon,
      badge: "/brand/kapsapp-tab.png",
      tag: "kapsapp-notification-" + alert.tag,
      renotify: isIncomingCall,
      requireInteraction: isIncomingCall,
      vibrate: isIncomingCall ? [500, 250, 500, 250, 500, 250, 500, 250, 500] : [200, 100, 200],
      actions: isIncomingCall
        ? [
            { action: "accept", title: "📞 Yanıtla" },
            { action: "reject", title: "✕ Reddet" },
          ]
        : [],
      data: { url: alert.url, isIncomingCall, alert },
    };

    await self.registration.showNotification(alert.title, notificationOptions);
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data || {};
    const action = event.action || "open";
    const target = new URL(data.url || "/", self.location.origin);
    if (target.origin !== self.location.origin) return;

    if (data.isIncomingCall && (action === "accept" || action === "reject" || action === "open")) {
      target.searchParams.set("callAction", action);
    }

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const page = windows.find(client => client.visibilityState === "visible") || windows[0];
    if (!page) {
      if (data.isIncomingCall && action === "reject") {
        return;
      }
      return self.clients.openWindow(target.href);
    }
    if (data.isIncomingCall) {
      page.postMessage({
        type: "kaps:incoming_call_action",
        action,
        alert: data.alert,
      });
      if (action === "reject") {
        return;
      }
      return page.focus();
    }
    if (data.url && page.url !== target.href) {
      const navigated = await page.navigate(target.href);
      return navigated?.focus();
    }
    return page.focus();
  })());
});
