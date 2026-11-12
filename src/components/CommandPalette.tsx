import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Home,
  MessageSquare,
  Globe,
  Folder,
  Calculator,
  CalendarDays,
  Compass,
  CloudSun,
  Megaphone,
  LayoutGrid,
  MapPin,
  Radio,
  Gamepad2,
  Users,
  Bell,
  UserCircle2,
  Settings as SettingsIcon,
  Crown,
  Palette,
  Volume2,
  EyeOff,
  BellOff,
  PanelLeftClose,
  ArrowRight,
  X,
  BookOpen,
  Sliders,
} from "lucide-react";
import { AppTab } from "../routes";
import { THEME_OPTIONS, ThemeId } from "../utils/theme";
import { UserPreferences, playNotificationChime } from "../utils/preferences";
import { SUBJECTS } from "../utils/subjectResources";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: AppTab) => void;
  onNavigateSubject: (subject: string) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (partial: Partial<UserPreferences>) => void;
  isEmirgan?: boolean;
}

interface CommandItem {
  id: string;
  category: "Sayfalar & Modüller" | "IB Ders Klasörleri" | "Temalar & Görünüm" | "Hızlı Ayarlar";
  title: string;
  subtitle: string;
  keywords: string;
  icon: React.ReactNode;
  badge?: string;
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigateTab,
  onNavigateSubject,
  preferences,
  onUpdatePreferences,
  isEmirgan = false,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
    }
  }, [isOpen]);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      {
        id: "nav-dashboard",
        category: "Sayfalar & Modüller",
        title: "Ana Sayfa (Kampüs Paneli)",
        subtitle: "Günlük ders akışı, özet kartlar ve hızlı erişim",
        keywords: "ana sayfa home dashboard kampüs özet",
        icon: <Home size={16} className="text-blue-500" />,
        action: () => {
          onNavigateTab("dashboard");
          onClose();
        },
      },
      {
        id: "nav-chats",
        category: "Sayfalar & Modüller",
        title: "Sohbetler & Özel Mesajlar",
        subtitle: "Birebir mesajlaşma ve grup odaları",
        keywords: "sohbetler mesaj dm chat grup",
        icon: <MessageSquare size={16} className="text-indigo-500" />,
        action: () => {
          onNavigateTab("chats");
          onClose();
        },
      },
      {
        id: "nav-global",
        category: "Sayfalar & Modüller",
        title: "Genel Sohbet",
        subtitle: "Tüm kampüs ile ortak anlık sohbet",
        keywords: "genel sohbet global chat topluluk",
        icon: <Globe size={16} className="text-emerald-500" />,
        action: () => {
          onNavigateTab("global");
          onClose();
        },
      },
      {
        id: "nav-folders",
        category: "Sayfalar & Modüller",
        title: "Ders Klasörleri & Not Arşivi",
        subtitle: "IB müfredatı PDF, IA, EE ve soru bankası kaynakları",
        keywords: "ders klasörleri notlar pdf ib kaynaklar",
        icon: <Folder size={16} className="text-blue-500" />,
        action: () => {
          onNavigateTab("folders");
          onClose();
        },
      },
      {
        id: "nav-ib-calc",
        category: "Sayfalar & Modüller",
        title: "KapsCulator (IB & Puan Hesaplayıcı)",
        subtitle: "IB Diploma puanı ve ders ağırlık hesaplama aracı",
        keywords: "kapsculator ib hesaplayıcı puan not",
        icon: <Calculator size={16} className="text-purple-500" />,
        action: () => {
          onNavigateTab("ib-calculator");
          onClose();
        },
      },
      {
        id: "nav-agenda",
        category: "Sayfalar & Modüller",
        title: "Ajanda & Sınav Takvimi",
        subtitle: "Ders programı, sınav tarihleri ve yemek menüsü",
        keywords: "ajanda takvim sınav program yemek",
        icon: <CalendarDays size={16} className="text-sky-500" />,
        action: () => {
          onNavigateTab("agenda");
          onClose();
        },
      },
      {
        id: "nav-ayvalik",
        category: "Sayfalar & Modüller",
        title: "Ayvalık CAS Projesi (25–27 Kasım)",
        subtitle: "Gezi programı, çoklu kaynak hava durumu, odalar ve galeri",
        keywords: "ayvalık cas gezi 25 27 kasım",
        icon: <Compass size={16} className="text-emerald-500" />,
        badge: "25–27 Kas",
        action: () => {
          onNavigateTab("ayvalik-cas");
          onClose();
        },
      },
      {
        id: "nav-weather",
        category: "Sayfalar & Modüller",
        title: "Kampüs Hava Durumu",
        subtitle: "Saatlik ve haftalık meteoroloji tahminleri ve giyim önerisi",
        keywords: "hava durumu meteoroloji yağmur sıcaklık",
        icon: <CloudSun size={16} className="text-sky-500" />,
        action: () => {
          onNavigateTab("weather");
          onClose();
        },
      },
      {
        id: "nav-announcements",
        category: "Sayfalar & Modüller",
        title: "Duyurular",
        subtitle: "Önemli okul ve platform bildirimleri",
        keywords: "duyurular haberler ilan",
        icon: <Megaphone size={16} className="text-amber-500" />,
        action: () => {
          onNavigateTab("announcements");
          onClose();
        },
      },
      {
        id: "nav-feed",
        category: "Sayfalar & Modüller",
        title: "Topluluk Akışı (Feed)",
        subtitle: "Öğrenci paylaşımları, fotoğraflar ve tartışmalar",
        keywords: "akış feed gönderi paylaşım",
        icon: <LayoutGrid size={16} className="text-blue-500" />,
        action: () => {
          onNavigateTab("feed");
          onClose();
        },
      },
      {
        id: "nav-map",
        category: "Sayfalar & Modüller",
        title: "Canlı Harita (Jeodezik Gizlilik Korumalı)",
        subtitle: "Arkadaşlarınızın kampüs ve şehir içi anlık konumu",
        keywords: "harita canlı konum gps map",
        icon: <MapPin size={16} className="text-teal-500" />,
        action: () => {
          onNavigateTab("map");
          onClose();
        },
      },
      {
        id: "nav-voice",
        category: "Sayfalar & Modüller",
        title: "Sesli & Görüntülü Çalışma Odaları",
        subtitle: "Düşük gecikmeli WebRTC ses kanalları ve ekran paylaşımı",
        keywords: "sesli sohbet görüntülü kamera mikrofon ekran",
        icon: <Radio size={16} className="text-violet-500" />,
        action: () => {
          onNavigateTab("voice");
          onClose();
        },
      },
      {
        id: "nav-games",
        category: "Sayfalar & Modüller",
        title: "Oyunlar & Sosyal Masalar",
        subtitle: "KapsStrike, Kapstorial, Dungeon, Batak, Okey, UNO, Blackjack",
        keywords: "oyunlar kapsstrike batak okey uno blackjack bilardo",
        icon: <Gamepad2 size={16} className="text-rose-500" />,
        action: () => {
          onNavigateTab("games");
          onClose();
        },
      },
      {
        id: "nav-friends",
        category: "Sayfalar & Modüller",
        title: "Arkadaşlar",
        subtitle: "Arkadaş listesi, çevrimiçi kişiler ve istekler",
        keywords: "arkadaşlar kişiler çevrimiçi",
        icon: <Users size={16} className="text-cyan-500" />,
        action: () => {
          onNavigateTab("friends");
          onClose();
        },
      },
      {
        id: "nav-notifications",
        category: "Sayfalar & Modüller",
        title: "Bildirimler",
        subtitle: "Beğeniler, yorumlar, davetler ve sistem uyarıları",
        keywords: "bildirimler uyarılar",
        icon: <Bell size={16} className="text-amber-500" />,
        action: () => {
          onNavigateTab("notifications");
          onClose();
        },
      },
      {
        id: "nav-profile",
        category: "Sayfalar & Modüller",
        title: "Profilim",
        subtitle: "Kişisel profil, avatar, roller ve paylaşımlarım",
        keywords: "profil hesap avatar",
        icon: <UserCircle2 size={16} className="text-blue-500" />,
        action: () => {
          onNavigateTab("profile");
          onClose();
        },
      },
      {
        id: "nav-settings",
        category: "Sayfalar & Modüller",
        title: "Ayarlar & Temalar",
        subtitle: "Tema seçimi, yazı boyutu, yoğunluk, ses, odak modu ve gizlilik",
        keywords: "ayarlar tema karanlık açık pembe lacivert zümrüt ametist ses gizlilik",
        icon: <SettingsIcon size={16} className="text-slate-500" />,
        action: () => {
          onNavigateTab("settings");
          onClose();
        },
      },
    ];

    if (isEmirgan) {
      list.unshift({
        id: "nav-admin",
        category: "Sayfalar & Modüller",
        title: "Emirgan Yönetim Paneli",
        subtitle: "Kullanıcı onayları, roller, çip yönetimi ve sistem kontrolü",
        keywords: "emirgan admin yönetim root",
        icon: <Crown size={16} className="text-amber-500" />,
        badge: "ROOT",
        action: () => {
          onNavigateTab("admin");
          onClose();
        },
      });
    }

    // Add IB Courses
    for (const subj of SUBJECTS) {
      list.push({
        id: `course-${subj}`,
        category: "IB Ders Klasörleri",
        title: `${subj} Ders Klasörü`,
        subtitle: `${subj} ders notları, soru kağıtları ve çalışma kaynakları`,
        keywords: `ders ${subj.toLowerCase()} klasör not`,
        icon: <BookOpen size={16} className="text-blue-500" />,
        action: () => {
          onNavigateSubject(subj);
          onClose();
        },
      });
    }

    // Add Themes
    for (const t of THEME_OPTIONS) {
      const isCurrent = preferences.theme === t.id;
      list.push({
        id: `theme-${t.id}`,
        category: "Temalar & Görünüm",
        title: `Tema: ${t.nameTr}`,
        subtitle: t.descriptionTr,
        keywords: `tema görünüm renk ${t.name.toLowerCase()} ${t.nameTr.toLowerCase()}`,
        icon: <Palette size={16} style={{ color: t.previewAccent }} />,
        badge: isCurrent ? "Aktif" : undefined,
        action: () => {
          onUpdatePreferences({ theme: t.id as ThemeId });
          onClose();
        },
      });
    }

    // Quick Settings Toggles
    list.push(
      {
        id: "toggle-dnd",
        category: "Hızlı Ayarlar",
        title: preferences.doNotDisturb
          ? "Odak Modunu (Rahatsız Etmeyin) Kapat"
          : "Odak Modunu (Rahatsız Etmeyin) Aç",
        subtitle: "Ders çalışırken anlık bildirim pencerelerini ve sesleri susturur",
        keywords: "odak modu rahatsız etmeyin dnd bildirim sessiz",
        icon: <BellOff size={16} className="text-amber-500" />,
        badge: preferences.doNotDisturb ? "Açık" : "Kapalı",
        action: () => {
          onUpdatePreferences({ doNotDisturb: !preferences.doNotDisturb });
          onClose();
        },
      },
      {
        id: "toggle-privacy",
        category: "Hızlı Ayarlar",
        title: preferences.privacyHideSensitive
          ? "Ekran Paylaşımı Gizlilik Maskesini Kapat"
          : "Ekran Paylaşımı Gizlilik Maskesini Aç",
        subtitle: "Özel mesaj önizlemelerini ve kişisel bilgileri fareyle üzerine gelene kadar bulanıklaştırır",
        keywords: "gizlilik ekran paylaşımı yayıncı bulanık maske",
        icon: <EyeOff size={16} className="text-emerald-500" />,
        badge: preferences.privacyHideSensitive ? "Açık" : "Kapalı",
        action: () => {
          onUpdatePreferences({ privacyHideSensitive: !preferences.privacyHideSensitive });
          onClose();
        },
      },
      {
        id: "toggle-sidebar",
        category: "Hızlı Ayarlar",
        title: preferences.sidebarCollapsed
          ? "Kenar Çubuğunu Genişlet"
          : "Kenar Çubuğunu Daralt (Kompakt İkon Modu)",
        subtitle: "Masaüstü sol menüsünü ikon şeridi veya tam liste görünümüne geçirir",
        keywords: "kenar çubuğu sidebar menü daralt genişlet",
        icon: <PanelLeftClose size={16} className="text-indigo-500" />,
        action: () => {
          onUpdatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed });
          onClose();
        },
      },
      {
        id: "density-compact",
        category: "Hızlı Ayarlar",
        title: "Arayüz Yoğunluğu: Kompakt",
        subtitle: "Ekrana daha fazla içerik sığdıran sıkılaştırılmış yerleşim",
        keywords: "yoğunluk kompakt sıkı dar yerleşim",
        icon: <Sliders size={16} className="text-blue-500" />,
        badge: preferences.density === "compact" ? "Aktif" : undefined,
        action: () => {
          onUpdatePreferences({ density: "compact" });
          onClose();
        },
      },
      {
        id: "density-default",
        category: "Hızlı Ayarlar",
        title: "Arayüz Yoğunluğu: Dengeli (Varsayılan)",
        subtitle: "Standart kart ve liste boşluk dengesi",
        keywords: "yoğunluk dengeli standart varsayılan",
        icon: <Sliders size={16} className="text-blue-500" />,
        badge: preferences.density === "default" ? "Aktif" : undefined,
        action: () => {
          onUpdatePreferences({ density: "default" });
          onClose();
        },
      },
      {
        id: "test-sound",
        category: "Hızlı Ayarlar",
        title: "Bildirim Sesini Test Et",
        subtitle: `Mevcut ses seviyesi: %${preferences.soundVolume}`,
        keywords: "ses test bildirim melodi",
        icon: <Volume2 size={16} className="text-emerald-500" />,
        action: () => {
          playNotificationChime(preferences.soundVolume);
        },
      }
    );

    return list;
  }, [isEmirgan, onClose, onNavigateSubject, onNavigateTab, onUpdatePreferences, preferences]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
        );
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        filteredItems[selectedIndex].action();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-14 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Hızlı Geçiş ve Komut Paleti"
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sayfa, ders klasörü, tema veya ayar ara... (Örn: Pembe, Fizik, Ayvalık, Odak)"
            aria-label="Komut ve sayfa arama"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
            >
              Temizle
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Komut paletini kapat"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                "{query}" ile eşleşen sonuç bulunamadı
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Sayfa adı, ders klasörü (Matematik, Fizik) veya tema (Karanlık, Pembe, Lacivert) arayabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const prevCategory = idx > 0 ? filteredItems[idx - 1].category : null;
                const showCategoryHeader = item.category !== prevCategory;

                return (
                  <React.Fragment key={item.id}>
                    {showCategoryHeader && (
                      <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                        {item.category}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={item.action}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/50 text-slate-900 dark:text-white"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold truncate flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.badge && (
                              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                · {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowRight
                        size={14}
                        className={`shrink-0 transition-transform ${
                          isSelected ? "text-blue-600 dark:text-blue-400 translate-x-0.5" : "text-slate-300 dark:text-slate-600"
                        }`}
                      />
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Keyboard Hints */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>↑↓ Gezin</span>
            <span>·</span>
            <span>↵ Seç</span>
            <span>·</span>
            <span>ESC Kapat</span>
          </div>
          <span>KapsApp Hızlı Erişim</span>
        </div>
      </div>
    </div>
  );
}
