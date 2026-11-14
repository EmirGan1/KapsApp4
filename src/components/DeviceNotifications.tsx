import { useEffect, useState } from "react";
import { getStoredPreferences, savePreferences } from "../utils/preferences";

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

const dismissedKey = "kapsapp-notification-dismissed";
const disabledKey = "kapsapp-notification-disabled";

export function needsNotificationInstall() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && !matchMedia("(display-mode: standalone)").matches &&
    (navigator as Navigator & { standalone?: boolean }).standalone !== true;
}

const installHelp = "Safari’de Paylaş → Ana Ekrana Ekle’yi seç. Ardından KapsApp’i ana ekrandan açıp İzin ver’e dokun.";
const blockedHelp = "Tarayıcıda bildirim izni engelli. Adres çubuğundaki site ayarlarından Bildirimler → İzin ver’i seç ve tekrar dene.";

function supported() {
  return window.isSecureContext && "Notification" in window && "serviceWorker" in navigator;
}

export function disableDeviceNotifications() {
  localStorage.setItem(disabledKey, "1");
  savePreferences({ desktopNotifs: false });
}

export async function enableDeviceNotifications() {
  if (needsNotificationInstall()) return installHelp;
  if (!supported()) return "Bu tarayıcı sistem bildirimlerini desteklemiyor.";
  try {
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission === "denied") return blockedHelp;
    if (permission !== "granted") return "İzin verilmedi. Adres çubuğundaki bildirim simgesini kontrol et veya tekrar dene.";
    await notificationWorker();
    localStorage.removeItem(disabledKey);
    savePreferences({ desktopNotifs: true });
    return "";
  } catch {
    return "Sistem bildirimleri başlatılamadı. Sayfayı yenileyip tekrar dene.";
  }
}

export async function showDeviceNotification(title: string, body: string, id?: number | string, preview = false) {
  const prefs = getStoredPreferences();
  if (!supported() || Notification.permission !== "granted" ||
      !prefs.desktopNotifs || (!preview && prefs.doNotDisturb)) return false;
  const options: NotificationOptions = {
    body: body.slice(0, 220),
    icon: "/brand/kapsapp-mark.png",
    tag: id == null ? undefined : `kapsapp-notification-${id}`,
  };
  try {
    await notificationWorker();
    const registration = await navigator.serviceWorker.ready;
    const current = getStoredPreferences();
    if (!current.desktopNotifs || (!preview && current.doNotDisturb)) return false;
    await registration.showNotification(`KapsApp · ${title}`, options);
    return true;
  } catch {
    return false;
  }
}

export function NotificationPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [iosInstall, setIosInstall] = useState(false);

  useEffect(() => {
    const needsInstall = needsNotificationInstall();
    setIosInstall(needsInstall);
    if (localStorage.getItem(disabledKey) || sessionStorage.getItem(dismissedKey)) return;
    setVisible(needsInstall || (supported() && Notification.permission !== "denied" &&
      (Notification.permission === "default" || !getStoredPreferences().desktopNotifs)));
    const hideAfterChoice = () => {
      if (getStoredPreferences().desktopNotifs || localStorage.getItem(disabledKey)) setVisible(false);
    };
    window.addEventListener("kaps:preferences_changed", hideAfterChoice);
    return () => window.removeEventListener("kaps:preferences_changed", hideAfterChoice);
  }, []);

  function dismiss() {
    sessionStorage.setItem(dismissedKey, "1");
    setVisible(false);
  }

  async function request() {
    setBusy(true);
    try {
      const result = await enableDeviceNotifications();
      setMessage(result);
      if (!result) setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  return (
    <aside aria-label="Bildirim izni" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[10000] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <p className="font-semibold">Bildirimlere izin ver?</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        {iosInstall ? "iPhone ve iPad’de sistem bildirimleri için KapsApp’i ana ekrandan aç." : "KapsApp açıkken yeni mesajları ve bildirimleri cihazında gör."}
      </p>
      {message && <p role="status" className="mt-2">{message}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2">Şimdi değil</button>
        <button type="button" disabled={busy} onClick={request} className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-60">{iosInstall ? "Nasıl açılır?" : "İzin ver"}</button>
      </div>
    </aside>
  );
}
