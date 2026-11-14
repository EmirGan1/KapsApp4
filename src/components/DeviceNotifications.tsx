import { useEffect, useState } from "react";

let worker: Promise<ServiceWorkerRegistration> | undefined;

function notificationWorker() {
  if (!worker) {
    worker = navigator.serviceWorker.register("/kapsapp-notifications.js").catch(error => {
      worker = undefined;
      throw error;
    });
  }
  return worker;
}

function supported() {
  return window.isSecureContext && "Notification" in window && "serviceWorker" in navigator;
}

export function showDeviceNotification(title: string, body: string, id?: number | string) {
  if (!supported() || Notification.permission !== "granted") return;
  void notificationWorker()
    .then(() => navigator.serviceWorker.ready)
    .then(registration => registration.showNotification(`KapsApp · ${title}`, {
      body: body.slice(0, 220),
      icon: "/brand/kapsapp-mark.png",
      tag: id == null ? undefined : `kapsapp-notification-${id}`,
    }))
    .catch(() => {});
}

export function NotificationPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [iosInstall, setIosInstall] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const needsInstall = ios && !standalone;
    setIosInstall(needsInstall);
    if (supported() && Notification.permission === "granted") {
      void notificationWorker().catch(() => {});
      return;
    }
    if (sessionStorage.getItem("kapsapp-notification-dismissed")) return;
    setVisible(needsInstall || (supported() && Notification.permission === "default"));
  }, []);

  function dismiss() {
    sessionStorage.setItem("kapsapp-notification-dismissed", "1");
    setVisible(false);
  }

  async function request() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await notificationWorker();
        setVisible(false);
      } else if (permission === "denied") {
        setMessage("Bildirimleri daha sonra tarayıcının site ayarlarından açabilirsin.");
      }
    } catch {
      setMessage("Bildirimler açılamadı. Tekrar deneyebilirsin.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  return (
    <aside aria-label="Bildirim izni" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[10000] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <p className="font-semibold">Bildirimlere izin ver?</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        {iosInstall ? "iPhone veya iPad’de Safari’nin Paylaş menüsünden Ana Ekrana Ekle’yi seç. KapsApp’i oradan açarak izin ver." : "KapsApp açıkken yeni mesajları ve bildirimleri cihazında gör."}
      </p>
      {message && <p role="status" className="mt-2">{message}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2">Şimdi değil</button>
        {!iosInstall && <button type="button" disabled={busy} onClick={request} className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-60">İzin ver</button>}
      </div>
    </aside>
  );
}
