// Centralized Route Configuration & SEO Metadata for KapsApp

export interface RouteMeta {
  path: string;
  tab: "announcements" | "agenda" | "global" | "chats" | "feed" | "folders" | "friends" | "profile" | "notifications" | "subject" | "games" | "voice" | "map" | "admin" | "weather" | "predicted" | "kapsat";
  title: string;
  description: string;
  keywords?: string;
  canonical: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  noindex?: boolean;
}

export const APP_ROUTES: Record<string, RouteMeta> = {
  home: {
    path: "/",
    tab: "chats",
    title: "KapsApp - Sesli Sohbet, Canlı Harita, Ders Klasörleri ve Sosyal Oyunlar",
    description: "KapsApp; gerçek zamanlı sesli sohbet kanalları, gizlilik korumalı canlı harita takibi, interaktif ders klasörleri/paylaşımı ile Batak, Blackjack 21, Okey, UNO ve Gartic sosyal oyunlarını tek bir çatı altında birleştiren yeni nesil sosyal iletişim ve eğitim platformudur.",
    canonical: "https://kapsapp.online/",
  },
  globalChat: {
    path: "/genel-sohbet",
    tab: "global",
    title: "Genel Sohbet | KapsApp",
    description: "KapsApp öğrencileri için gerçek zamanlı genel sohbet ve yardımlaşma alanı. Tüm okul ve toplulukla anında iletişime geçin.",
    canonical: "https://kapsapp.online/genel-sohbet",
  },
  courses: {
    path: "/dersler",
    tab: "folders",
    title: "Dersler ve Not Paylaşımı | KapsApp",
    description: "IB müfredatına uygun ders materyalleri, çalışma klasörleri, PDF notları ve akademik paylaşım merkezi.",
    canonical: "https://kapsapp.online/dersler",
  },
  kapsat: {
    path: "/kapsat",
    tab: "kapsat",
    title: "kapSAT - Digital SAT Hazırlık | KapsApp",
    description: "Matematik ve Reading/Writing pratik testleri, konu bazlı soru bankası ve yapay zeka destekli tam deneme sınavları.",
    canonical: "https://kapsapp.online/kapsat",
    noindex: true,
  },
  games: {
    path: "/oyunlar",
    tab: "games",
    title: "Oyunlar ve Eğlence | KapsApp",
    description: "KapsPool 8-Ball Bilardo, Party Mode turnuvaları, Klasik Okey, 101 Okey, Batak ve çok oyunculu masa oyunları.",
    canonical: "https://kapsapp.online/oyunlar",
  },
  weather: {
    path: "/hava-durumu",
    tab: "weather",
    title: "Hava Durumu ve Kampüs Rehberi | KapsApp",
    description: "İstanbul ve okul lokasyonu anlık hava durumu, saatlik tahminler, yağış uyarıları ve yapay zeka destekli giyim önerileri.",
    canonical: "https://kapsapp.online/hava-durumu",
  },
  profile: {
    path: "/profil",
    tab: "profile",
    title: "Profil ve İstatistikler | KapsApp",
    description: "Kullanıcı profili, başarımlar, oyun çipleri, ekran süresi ve hesap ayarları.",
    canonical: "https://kapsapp.online/profil",
  },
  admin: {
    path: "/emirgan",
    tab: "admin",
    title: "Emirgan Yönetim Paneli | KapsApp",
    description: "KapsApp sistem yönetimi, kullanıcı yetkilendirme, cihaz banlama ve genel denetim merkezi.",
    canonical: "https://kapsapp.online/emirgan",
    adminOnly: true,
  },
  agenda: {
    path: "/ajanda",
    tab: "agenda",
    title: "Ajanda ve Takvim | KapsApp",
    description: "Ders programı, sınav tarihleri, ödev takibi, zil saatleri ve aylık yemek menüsü takvimi.",
    canonical: "https://kapsapp.online/ajanda",
  },
  announcements: {
    path: "/duyurular",
    tab: "announcements",
    title: "Duyurular | KapsApp",
    description: "KapsApp topluluk duyuruları, etkinlik bildirimleri ve önemli okul güncellemeleri.",
    canonical: "https://kapsapp.online/duyurular",
  },
  feed: {
    path: "/akis",
    tab: "feed",
    title: "Sosyal Akış | KapsApp",
    description: "Öğrenci paylaşımları, soru-cevap tartışmaları, fotoğraflar ve sosyal etkileşim akışı.",
    canonical: "https://kapsapp.online/akis",
  },
  map: {
    path: "/harita",
    tab: "map",
    title: "Canlı Harita | KapsApp",
    description: "Gizlilik korumalı jeodezik canlı konum haritası ile kampüsteki ve şehirdeki arkadaşlarınızı keşfedin.",
    canonical: "https://kapsapp.online/harita",
  },
  voice: {
    path: "/sesli-sohbet",
    tab: "voice",
    title: "Sesli & Görüntülü Sohbet | KapsApp",
    description: "Düşük gecikmeli WebRTC tabanlı grup sesli kanalları ve görüntülü ders çalışma odaları.",
    canonical: "https://kapsapp.online/sesli-sohbet",
  },
  friends: {
    path: "/arkadaslar",
    tab: "friends",
    title: "Arkadaşlar | KapsApp",
    description: "Arkadaş listesi, istek yönetimi ve çevrimiçi durum takibi.",
    canonical: "https://kapsapp.online/arkadaslar",
  },
  notifications: {
    path: "/bildirimler",
    tab: "notifications",
    title: "Bildirimler | KapsApp",
    description: "Kişisel mesajlar, oyun davetleri ve sistem bildirimleri merkezi.",
    canonical: "https://kapsapp.online/bildirimler",
  },
  predicted: {
    path: "/tahminler",
    tab: "predicted",
    title: "IB Predicted Not Değerlendirme | KapsApp",
    description: "12 G IB Diploma Programı ders bazlı öngörülen not tahminleri ve denetim paneli.",
    canonical: "https://kapsapp.online/tahminler",
  },
};

// Map URL pathname to internal Tab name
export function getTabFromPathname(pathname: string): {
  tab: "announcements" | "agenda" | "global" | "chats" | "feed" | "folders" | "friends" | "profile" | "notifications" | "subject" | "games" | "voice" | "map" | "admin" | "weather" | "predicted" | "kapsat";
  subject?: string;
  userId?: number;
} {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  // Dynamic course folder route: /dersler/:courseId
  if (cleanPath.startsWith("/dersler/")) {
    const rawCourse = cleanPath.slice("/dersler/".length);
    const subject = decodeURIComponent(rawCourse);
    return { tab: "subject", subject };
  }

  // Dynamic user profile route: /profil/:userId
  if (cleanPath.startsWith("/profil/")) {
    const rawId = cleanPath.slice("/profil/".length);
    const userId = Number(rawId);
    if (!isNaN(userId) && userId > 0) {
      return { tab: "profile", userId };
    }
    return { tab: "profile" };
  }

  // Alternate admin path /admin
  if (cleanPath === "/admin" || cleanPath === "/emirgan") {
    return { tab: "admin" };
  }

  // Alternate chats path /sohbetler
  if (cleanPath === "/sohbetler") {
    return { tab: "chats" };
  }

  // Exact matches
  for (const key of Object.keys(APP_ROUTES)) {
    const meta = APP_ROUTES[key];
    if (meta.path === cleanPath) {
      return { tab: meta.tab };
    }
  }

  // Fallback to chats (home)
  return { tab: "chats" };
}

// Map internal Tab name to primary URL path
export function getPathFromTab(
  tab: "announcements" | "agenda" | "global" | "chats" | "feed" | "folders" | "friends" | "profile" | "notifications" | "subject" | "games" | "voice" | "map" | "admin" | "weather" | "predicted" | "kapsat",
  subject?: string | null,
  userId?: number | null,
  currentUserId?: number
): string {
  if (tab === "subject" && subject) {
    return `/dersler/${encodeURIComponent(subject)}`;
  }
  if (tab === "profile" && userId && currentUserId && userId !== currentUserId) {
    return `/profil/${userId}`;
  }

  switch (tab) {
    case "chats": return "/";
    case "global": return "/genel-sohbet";
    case "folders": return "/dersler";
    case "kapsat": return "/kapsat";
    case "games": return "/oyunlar";
    case "weather": return "/hava-durumu";
    case "profile": return "/profil";
    case "admin": return "/emirgan";
    case "agenda": return "/ajanda";
    case "announcements": return "/duyurular";
    case "feed": return "/akis";
    case "map": return "/harita";
    case "voice": return "/sesli-sohbet";
    case "friends": return "/arkadaslar";
    case "notifications": return "/bildirimler";
    case "predicted": return "/tahminler";
    default: return "/";
  }
}
