self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const page = windows.find(client => client.visibilityState === "visible") || windows[0];
    if (page) return page.focus();
    return self.clients.openWindow("/");
  })());
});
