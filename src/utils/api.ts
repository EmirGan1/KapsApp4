import { getCachedHardwareFingerprint, getHardwareFingerprint } from "./deviceFingerprint";

// Detect if running in native mobile shell (Capacitor webview / file protocol)
const isNativeApp = typeof window !== "undefined" && (
  window.location.protocol.startsWith("capacitor:") ||
  window.location.protocol.startsWith("file:") ||
  window.location.protocol.startsWith("ionic:")
);

const isHttp = typeof window !== "undefined" && window.location.protocol.startsWith("http");

// Frontend API Absolute Base URL Guarantee (Capacitor / Android WebView / Web)
export const API_BASE_URL = (
  isNativeApp ? "https://kapsapp.online" : (isHttp ? window.location.origin : "")
).replace(/\/$/, "");

export const BASE_URL = API_BASE_URL;
export const BACKEND_URL = API_BASE_URL;

// Socket.IO Server Address Guarantee
export const SOCKET_URL = (
  (typeof window !== "undefined" && isNativeApp)
    ? "https://kapsapp.online"
    : (API_BASE_URL || (typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://kapsapp.online"))
).replace(/\/$/, "");

/**
 * Returns API URL (relative on web to avoid CORS/proxy issues, absolute on native apps)
 */
export function getApiUrl(path: string = ""): string {
  if (!path) return isNativeApp ? API_BASE_URL : "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (isNativeApp) {
    return `${API_BASE_URL}${cleanPath}`;
  }
  return cleanPath;
}

/**
 * Returns Socket.IO URL
 */
export function getSocketUrl(): string {
  return SOCKET_URL || "https://kapsapp.online";
}

/**
 * Returns standard headers including Bearer Token and Hardware Fingerprints
 */
export function getAuthHeaders(extraHeaders?: HeadersInit): Headers {
  const headers = new Headers(extraHeaders || {});

  const token = typeof localStorage !== "undefined" 
    ? (localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token"))
    : null;

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const hwFingerprint = getCachedHardwareFingerprint();
  if (hwFingerprint && hwFingerprint !== "hw_pending_init") {
    if (!headers.has("X-Hardware-Fingerprint")) headers.set("X-Hardware-Fingerprint", hwFingerprint);
    if (!headers.has("X-Device-Id")) headers.set("X-Device-Id", hwFingerprint);
  }

  return headers;
}

/**
 * Safe fetch JSON wrapper with automatic JWT Bearer token, Physical Hardware Fingerprint headers
 * (`X-Hardware-Fingerprint` & `X-Device-Id`), withCredentials support, retry logic, and instantaneous Device Ban interception.
 */
export async function safeFetchJson<T = any>(input: string, init?: RequestInit): Promise<T> {
  const targetUrl = getApiUrl(input);
  
  // Ensure physical hardware fingerprint is ready (non-blocking fallback)
  let hwFingerprint = getCachedHardwareFingerprint();
  if (!hwFingerprint || hwFingerprint === "hw_pending_init") {
    try {
      hwFingerprint = await getHardwareFingerprint();
    } catch {
      hwFingerprint = "hw_fallback_client";
    }
  }

  const headers = getAuthHeaders(init?.headers);
  if (hwFingerprint) {
    headers.set("X-Hardware-Fingerprint", hwFingerprint);
    headers.set("X-Device-Id", hwFingerprint);
  }

  let res: Response | null = null;
  let lastNetworkErr: any = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      res = await fetch(targetUrl, {
        credentials: init?.credentials || "include",
        ...init,
        headers
      });
      break;
    } catch (networkErr: any) {
      lastNetworkErr = networkErr;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
  }

  if (!res) {
    console.error(`[API Network Error] Hedef URL: ${targetUrl}`, lastNetworkErr);
    throw new Error(`Sunucuya bağlanılamadı (${API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "")}). Lütfen internet bağlantınızı veya sunucu erişimini kontrol edin.`);
  }

  const contentType = res.headers.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    const text = await res.text();
    console.error(`Beklenmeyen sunucu yanıtı (${res.status} ${res.statusText}) URL: ${targetUrl}:`, text);
    throw new Error(`Sunucuya bağlanılamadı (${API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "")}). Backend servisi henüz uyanmamış veya çevrimdışı olabilir.`);
  }

  const data = await res.json();
  
  // Hardware / Device Ban interceptor
  if (res.status === 403 && (data.banned || data.type === "device_banned" || data.error === "DEVICE_BANNED")) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kaps:device_banned", { detail: data }));
    }
    throw new Error(data.message || data.error || "Bu cihaz platform kurallarının ihlali nedeniyle kalıcı olarak yasaklanmıştır.");
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || data.messageTr || "İşlem gerçekleştirilemedi.");
  }

  return data;
}
