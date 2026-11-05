import React, { useState, useEffect, useRef, useMemo } from "react";
import { Socket } from "socket.io-client";
import DOMPurify from "dompurify";
import { 
  Megaphone, Plus, Trash2, CheckCircle2, Clock, 
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, 
  Type, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, 
  Palette, Sparkles, AlertCircle, Eye, RefreshCw, Send, ShieldAlert, X,
  Users, Target, ImagePlus, Image as ImageIcon, Loader2, Download
} from "lucide-react";
import { AnnouncementItem, AnnouncementStyles, isVisibleToUser, parseTargetRoles } from "../types";
import TargetRoleSelector from "./TargetRoleSelector";
import TargetRoleBadge from "./TargetRoleBadge";
import { getApiUrl } from "../utils/api";

export type { AnnouncementStyles, AnnouncementItem };

interface AnnouncementsProps {
  socket: Socket | null;
  username: string;
  currentUserId: number;
  currentUserRoles?: string[];
  onAnnouncementsRead?: (latestId: number) => void;
}

const COLOR_PRESETS = [
  { name: "Varsayılan", color: "inherit" },
  { name: "Mavi", color: "#2563eb" },
  { name: "Zümrüt Yeşili", color: "#059669" },
  { name: "Kırmızı / Uyarı", color: "#dc2626" },
  { name: "Kehribar / Sarı", color: "#d97706" },
  { name: "Mor", color: "#7c3aed" },
  { name: "Pembe", color: "#db2777" },
  { name: "Koyu Gri", color: "#1e293b" }
];

export default function Announcements({
  socket,
  username,
  currentUserId,
  currentUserRoles = [],
  onAnnouncementsRead
}: AnnouncementsProps) {
  const isEmirgan = username.trim().toLowerCase() === "emirgan";

  // Effective user roles
  const effectiveRoles = useMemo(() => {
    if (Array.isArray(currentUserRoles)) {
      return currentUserRoles;
    }
    try {
      const stored = localStorage.getItem("lan_user_roles");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [currentUserRoles]);

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Form states for 'emirgan'
  const [title, setTitle] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [selectedColor, setSelectedColor] = useState("inherit");
  const [selectedWeight, setSelectedWeight] = useState<"normal" | "medium" | "bold">("normal");
  const [selectedSize, setSelectedSize] = useState<"sm" | "base" | "lg" | "xl">("base");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [formError, setFormError] = useState("");

  // Photo attachment states for 'emirgan'
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editorRef = useRef<HTMLDivElement>(null);

  const sanitizeOptions = useMemo(() => ({
    ADD_TAGS: ['img', 'iframe', 'span', 'p', 'div', 'br', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'b', 'i'],
    ADD_ATTR: ['src', 'alt', 'class', 'style', 'loading', 'decoding', 'target', 'rel', 'href', 'title']
  }), []);

  // Load announcements
  const loadAnnouncements = () => {
    if (!socket) return;
    setIsLoading(true);
    socket.emit("get_announcements", (res: any) => {
      setIsLoading(false);
      if (res?.announcements && Array.isArray(res.announcements)) {
        const sorted = [...res.announcements].sort((a, b) => b.id - a.id);
        setAnnouncements(sorted);
        if (sorted.length > 0 && onAnnouncementsRead) {
          onAnnouncementsRead(sorted[0].id);
        }
      }
    });
  };

  useEffect(() => {
    loadAnnouncements();

    if (!socket) return;

    const handleNewAnnouncement = (newAnn: AnnouncementItem) => {
      setAnnouncements((prev) => {
        const exists = prev.some((a) => a.id === newAnn.id);
        if (exists) return prev;
        const updated = [newAnn, ...prev];
        if (onAnnouncementsRead) {
          onAnnouncementsRead(newAnn.id);
        }
        return updated;
      });
    };

    const handleAnnouncementDeleted = ({ id }: { id: number }) => {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    };

    socket.on("new_announcement", handleNewAnnouncement);
    socket.on("announcement_deleted", handleAnnouncementDeleted);

    return () => {
      socket.off("new_announcement", handleNewAnnouncement);
      socket.off("announcement_deleted", handleAnnouncementDeleted);
    };
  }, [socket]);

  // Execute formatting command in contenteditable
  const formatDoc = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
  };

  // Handle image selection via input
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    setFormError("");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          alert("Lütfen sadece fotoğraf / görsel dosyası seçiniz.");
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
        const res = await fetch(getApiUrl("/api/upload"), {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        });

        if (!res.ok) {
          throw new Error("Fotoğraf yüklenemedi.");
        }

        const data = await res.json();
        const fullUrl = getApiUrl(data.url);

        setAttachedImages((prev) => [...prev, fullUrl]);

        // Insert image HTML into editor
        const imgHtml = `<p><img src="${fullUrl}" alt="Duyuru Fotoğrafı" class="max-w-full h-auto rounded-2xl my-3 shadow-md border border-slate-200 dark:border-slate-800 object-cover cursor-pointer hover:opacity-95 transition-opacity" /></p><p><br></p>`;

        if (editorRef.current) {
          editorRef.current.focus();
          document.execCommand("insertHTML", false, imgHtml);
          setEditorHtml(editorRef.current.innerHTML);
        } else {
          setEditorHtml((prev) => prev + imgHtml);
        }
      }
    } catch (err: any) {
      console.error("Duyuru fotoğrafı yükleme hatası:", err);
      setFormError(err.message || "Fotoğraf yüklenirken bir hata oluştu.");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // Handle paste image directly into contenteditable editor
  const handleEditorPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) continue;

        setIsUploadingImage(true);
        try {
          const formData = new FormData();
          formData.append("file", blob);
          const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
          const res = await fetch(getApiUrl("/api/upload"), {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            const fullUrl = getApiUrl(data.url);
            setAttachedImages((prev) => [...prev, fullUrl]);
            const imgHtml = `<p><img src="${fullUrl}" alt="Duyuru Fotoğrafı" class="max-w-full h-auto rounded-2xl my-3 shadow-md border border-slate-200 dark:border-slate-800 object-cover cursor-pointer hover:opacity-95 transition-opacity" /></p><p><br></p>`;
            document.execCommand("insertHTML", false, imgHtml);
            if (editorRef.current) setEditorHtml(editorRef.current.innerHTML);
          }
        } catch (err) {
          console.error("Paste image error:", err);
        } finally {
          setIsUploadingImage(false);
        }
      }
    }
  };

  // Remove attached image
  const removeAttachedImage = (urlToRemove: string) => {
    setAttachedImages((prev) => prev.filter((u) => u !== urlToRemove));
    if (editorRef.current) {
      const currentContent = editorRef.current.innerHTML;
      const cleanContent = currentContent.replace(
        new RegExp(`<p><img[^>]*src="${urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></p>`, 'gi'),
        ''
      ).replace(
        new RegExp(`<img[^>]*src="${urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'gi'),
        ''
      );
      editorRef.current.innerHTML = cleanContent;
      setEditorHtml(cleanContent);
    }
  };

  // Set template
  const applyTemplate = (type: "maintenance" | "feature" | "rules") => {
    let tTitle = "";
    let tHtml = "";

    if (type === "maintenance") {
      tTitle = "🛠️ Sistem Bakım ve Güncelleme Bilgilendirmesi";
      tHtml = `<h2><span style="color: #d97706;"><strong>Planlı Sistem Güncellemesi</strong></span></h2><p>Değerli üyelerimiz, sistem altyapımızda daha iyi bir kullanıcı deneyimi sağlamak adına kısa süreli bir optimizasyon çalışması gerçekleştirilecektir.</p><ul><li><strong>Tarih:</strong> Bu gece 03:00 - 04:00</li><li><strong>Kapsam:</strong> Sunucu ve canlı bağlantı hızlandırmaları</li></ul><p><span style="color: #059669;"><em>Çalışma süresince kesintisiz hizmet için teşekkür ederiz.</em></span></p>`;
    } else if (type === "feature") {
      tTitle = "🎉 Yeni Özellikler Yayında!";
      tHtml = `<h2><span style="color: #2563eb;"><strong>Platformumuza Yeni Özellikler Eklendi</strong></span></h2><p>Topluluğumuz için geliştirdiğimiz en yeni fonksiyonlar artık aktif:</p><ul><li><span style="color: #059669;"><strong>Canlı Harita & Konum Paylaşımı:</strong></span> Arkadaşlarınızı haritada görün.</li><li><span style="color: #7c3aed;"><strong>Duyuru & Bilgilendirme Sistemi:</strong></span> Önemli bildirimleri anında yakalayın.</li></ul><p>Keyifli vakitler dileriz!</p>`;
    } else if (type === "rules") {
      tTitle = "⚠️ Topluluk Kuralları ve Güvenlik Hatırlatması";
      tHtml = `<h2><span style="color: #dc2626;"><strong>Önemli Topluluk Kuralları</strong></span></h2><p>Platformumuzda tüm üyelerimizin huzurlu ve güvenli vakit geçirmesi için aşağıdaki kurallara riayet edilmesi zorunludur:</p><ol><li>Diğer kullanıcılara saygılı ve nezaketli davranınız.</li><li>Yanıltıcı veya uygunsuz paylaşımlarda bulunmayınız.</li><li>Kural ihlallerinde 5651 sayılı kanun uyarınca hesaplar askıya alınabilir.</li></ol>`;
    }

    setTitle(tTitle);
    setEditorHtml(tHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = tHtml;
    }
  };

  // Publish announcement
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanContent = (editorRef.current?.innerHTML || editorHtml || "").trim();
    if (!cleanContent || cleanContent === "<p><br></p>" || cleanContent === "<div><br></div>") {
      setFormError("Lütfen duyuru içeriğini doldurunuz.");
      return;
    }

    if (!title.trim()) {
      setFormError("Lütfen bir duyuru başlığı giriniz.");
      return;
    }

    if (!socket) {
      setFormError("Sunucu bağlantısı bulunamadı.");
      return;
    }

    const stylesPayload: AnnouncementStyles = {
      color: selectedColor,
      fontWeight: selectedWeight,
      fontSize: selectedSize
    };

    setIsPublishing(true);
    socket.emit("create_announcement", {
      title: title.trim(),
      content: cleanContent,
      styles: stylesPayload,
      targetRoles
    }, (res: any) => {
      setIsPublishing(false);
      if (res?.error) {
        setFormError(res.error);
      } else {
        setTitle("");
        setEditorHtml("");
        if (editorRef.current) {
          editorRef.current.innerHTML = "";
        }
        setSelectedColor("inherit");
        setSelectedWeight("normal");
        setSelectedSize("base");
        setTargetRoles([]);
        setShowEditor(false);
        setPreviewMode(false);
        loadAnnouncements();
      }
    });
  };

  // Delete announcement (admin only)
  const handleDelete = (id: number) => {
    if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    if (socket) {
      socket.emit("delete_announcement", { id });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-text">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Megaphone size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Duyurular
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                {announcements.length}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Platform yöneticisi tarafından yayınlanan resmi bildirimler ve güncellemeler
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAnnouncements}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Yenile"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>

          {isEmirgan && (
            <button
              onClick={() => setShowEditor(!showEditor)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {showEditor ? <X size={16} /> : <Plus size={16} />}
              <span>{showEditor ? "Kapat" : "Yeni Duyuru Gönder"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 touch-pan-y overscroll-y-contain">
        {/* 'emirgan' Special Rich Text Editor Panel */}
        {isEmirgan && showEditor && (
          <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 dark:border-blue-500/30 rounded-3xl p-5 shadow-xl shadow-blue-500/5 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Yönetici Duyuru Editörü (Zengin Metin & HTML)
                </h3>
              </div>

              {/* Quick Templates */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Şablonlar:</span>
                <button
                  type="button"
                  onClick={() => applyTemplate("maintenance")}
                  className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[11px] font-medium hover:bg-amber-100 transition-colors"
                >
                  Bakım
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("feature")}
                  className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-medium hover:bg-blue-100 transition-colors"
                >
                  Yenilik
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("rules")}
                  className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-[11px] font-medium hover:bg-red-100 transition-colors"
                >
                  Kurallar
                </button>
              </div>
            </div>

            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Duyuru Başlığı
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Önemli Sistem Güncellemesi ve Yenilikler"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors"
                />
              </div>

              {/* Style Controls (Yazı Rengi, Kalınlık, Boyut) */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Palette size={14} className="text-blue-500" />
                  <span>Duyuru Görünüm ve Tipografi Seçenekleri</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Color Selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Yazı Rengi
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map((cp) => (
                        <button
                          key={cp.color}
                          type="button"
                          onClick={() => setSelectedColor(cp.color)}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-transform cursor-pointer ${
                            selectedColor === cp.color 
                              ? "ring-2 ring-blue-500 scale-110 border-white shadow-sm" 
                              : "border-slate-300 dark:border-slate-600 hover:scale-105"
                          }`}
                          style={{ backgroundColor: cp.color === "inherit" ? "#64748b" : cp.color }}
                          title={cp.name}
                        >
                          {selectedColor === cp.color && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                          )}
                        </button>
                      ))}
                      <input
                        type="color"
                        value={selectedColor.startsWith("#") ? selectedColor : "#2563eb"}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="w-6 h-6 p-0 rounded-lg border-0 cursor-pointer"
                        title="Özel Renk Seç"
                      />
                    </div>
                  </div>

                  {/* Font Weight */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Yazı Kalınlığı (Font Weight)
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedWeight("normal")}
                        className={`py-1 rounded-lg font-normal transition-colors cursor-pointer ${
                          selectedWeight === "normal"
                            ? "bg-blue-600 text-white font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedWeight("medium")}
                        className={`py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          selectedWeight === "medium"
                            ? "bg-blue-600 text-white font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Orta
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedWeight("bold")}
                        className={`py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                          selectedWeight === "bold"
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Kalın
                      </button>
                    </div>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Yazı Boyutu (Font Size)
                    </label>
                    <div className="grid grid-cols-4 gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedSize("sm")}
                        className={`py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                          selectedSize === "sm"
                            ? "bg-blue-600 text-white font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Küçük
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSize("base")}
                        className={`py-1 rounded-lg transition-colors cursor-pointer ${
                          selectedSize === "base"
                            ? "bg-blue-600 text-white font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSize("lg")}
                        className={`py-1 rounded-lg transition-colors cursor-pointer ${
                          selectedSize === "lg"
                            ? "bg-blue-600 text-white font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Büyük
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSize("xl")}
                        className={`py-1 rounded-lg transition-colors cursor-pointer ${
                          selectedSize === "xl"
                            ? "bg-blue-600 text-white font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        Başlık
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rich Text Editor Toolbar */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex flex-wrap items-center gap-1 text-slate-700 dark:text-slate-300">
                  {/* Text Size & Heading */}
                  <button
                    type="button"
                    onClick={() => formatDoc("formatBlock", "<h1>")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Büyük Başlık (H1)"
                  >
                    <Heading1 size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("formatBlock", "<h2>")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Alt Başlık (H2)"
                  >
                    <Heading2 size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("formatBlock", "<p>")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Normal Paragraf"
                  >
                    <Type size={17} />
                  </button>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Formatting */}
                  <button
                    type="button"
                    onClick={() => formatDoc("bold")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold"
                    title="Kalın (Bold)"
                  >
                    <Bold size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("italic")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors italic"
                    title="İtalik (Italic)"
                  >
                    <Italic size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("underline")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors underline"
                    title="Altı Çizili"
                  >
                    <Underline size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("strikeThrough")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Üstü Çizili"
                  >
                    <Strikethrough size={17} />
                  </button>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Text Color Picker Toolbar */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColorMenu(!showColorMenu)}
                      className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-semibold cursor-pointer"
                      title="Yazı Rengi"
                    >
                      <Palette size={17} style={{ color: selectedColor === "inherit" ? undefined : selectedColor }} />
                      <span className="w-3 h-3 rounded-full border border-slate-400" style={{ backgroundColor: selectedColor === "inherit" ? "#94a3b8" : selectedColor }}></span>
                    </button>

                    {showColorMenu && (
                      <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 shadow-xl grid grid-cols-4 gap-2 w-48 animate-in fade-in">
                        {COLOR_PRESETS.map((cp) => (
                          <button
                            key={cp.color}
                            type="button"
                            onClick={() => {
                              setSelectedColor(cp.color);
                              formatDoc("foreColor", cp.color);
                              setShowColorMenu(false);
                            }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer"
                            style={{ backgroundColor: cp.color === "inherit" ? "#94a3b8" : cp.color }}
                            title={cp.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Alignment */}
                  <button
                    type="button"
                    onClick={() => formatDoc("justifyLeft")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Sola Hizala"
                  >
                    <AlignLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("justifyCenter")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Ortala"
                  >
                    <AlignCenter size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("justifyRight")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Sağa Hizala"
                  >
                    <AlignRight size={17} />
                  </button>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Lists */}
                  <button
                    type="button"
                    onClick={() => formatDoc("insertUnorderedList")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Madde İşaretli Liste"
                  >
                    <List size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("insertOrderedList")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Numaralı Liste"
                  >
                    <ListOrdered size={17} />
                  </button>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Photo Upload Button for Emirgan */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-all text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
                    title="Duyuruya Fotoğraf / Görsel Ekle"
                  >
                    {isUploadingImage ? (
                      <Loader2 size={15} className="animate-spin text-blue-600" />
                    ) : (
                      <ImagePlus size={15} />
                    )}
                    <span>{isUploadingImage ? "Fotoğraf Yükleniyor..." : "Fotoğraf Ekle"}</span>
                  </button>

                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  <div className="flex-1"></div>

                  {/* Preview Toggle */}
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      previewMode 
                        ? "bg-blue-600 text-white" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Eye size={14} />
                    <span>{previewMode ? "Düzenle" : "Önizle"}</span>
                  </button>
                </div>

                {/* Content Area */}
                {previewMode ? (
                  <div className="p-5 min-h-[160px] max-h-[300px] overflow-y-auto bg-slate-50 dark:bg-slate-950/50 prose prose-sm dark:prose-invert max-w-none text-slate-900 dark:text-white">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(editorRef.current?.innerHTML || editorHtml || "<em>İçerik boş.</em>", sanitizeOptions)
                      }}
                    />
                  </div>
                ) : (
                  <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleEditorInput}
                    onPaste={handleEditorPaste}
                    data-placeholder="Duyuru metnini yazınız... (Fotoğraf sürükleyip bırakabilir, yapıştırabilir veya 'Fotoğraf Ekle' butonunu kullanabilirsiniz)"
                    className="p-5 min-h-[160px] max-h-[300px] overflow-y-auto focus:outline-none text-slate-900 dark:text-white text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:cursor-text"
                  />
                )}

                {/* Attached Photos Thumbnail Strip */}
                {attachedImages.length > 0 && (
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-2 overflow-x-auto">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                      <ImageIcon size={14} className="text-blue-500" />
                      Ekli Fotoğraflar ({attachedImages.length}):
                    </span>
                    {attachedImages.map((imgUrl, idx) => (
                      <div key={idx} className="relative group shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs">
                        <img src={imgUrl} alt={`Fotoğraf ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeAttachedImage(imgUrl)}
                          className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full p-0.5 shadow-md cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
                          title="Fotoğrafı Kaldır"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Target Course Roles Selector */}
              <TargetRoleSelector
                selectedRoles={targetRoles}
                onChange={setTargetRoles}
                label="Kimler Görebilir? (Hedef Ders Rolleri)"
              />

              {formError && (
                <div className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900/60 flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Send size={15} />
                  <span>{isPublishing ? "Yayınlanıyor..." : "Duyuruyu Canlı Yayınla"}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filtered Announcements List based on User IB Course Roles */}
        {(() => {
          const visibleAnnouncements = announcements.filter((a) =>
            isVisibleToUser(a.targetRoles, effectiveRoles, isEmirgan)
          );

          if (isLoading) {
            return (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs">Duyurular yükleniyor...</p>
              </div>
            );
          }

          if (visibleAnnouncements.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-4">
                  <Megaphone size={28} />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base mb-1">
                  Henüz Duyuru Bulunmuyor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isEmirgan
                    ? "Yukarıdaki 'Yeni Duyuru Oluştur' butonuna tıklayarak yeni bir duyuru yayınlayabilirsiniz."
                    : "Derslerinize veya genel kullanıma uygun yayınlanan bir duyuru bulunmuyor."}
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {visibleAnnouncements.map((ann, idx) => {
                const formattedDate = new Date(ann.created_at).toLocaleString("tr-TR", {
                  dateStyle: "medium",
                  timeStyle: "short"
                });

                const parsedStyles: AnnouncementStyles = typeof ann.styles === "string" 
                  ? (() => { try { return JSON.parse(ann.styles as string); } catch(e) { return {}; } })() 
                  : (ann.styles || {});

                const customColor = parsedStyles.color && parsedStyles.color !== "inherit" ? parsedStyles.color : undefined;
                const weightClass = parsedStyles.fontWeight === "bold" ? "font-bold" : parsedStyles.fontWeight === "medium" ? "font-medium" : "font-normal";
                const sizeClass = parsedStyles.fontSize === "xl" ? "text-base sm:text-lg font-semibold" : parsedStyles.fontSize === "lg" ? "text-sm sm:text-base" : parsedStyles.fontSize === "sm" ? "text-xs" : "text-xs sm:text-sm";

                return (
                  <div
                    key={ann.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                  >
                    {/* Top Accent Line for the newest announcement */}
                    {idx === 0 && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"></div>
                    )}

                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {ann.author_username?.[0]?.toUpperCase() || "E"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {ann.author_username}
                            </span>
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1">
                              <ShieldAlert size={11} /> Yönetici
                            </span>
                            <TargetRoleBadge targetRolesRaw={ann.targetRoles} size="sm" />
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Clock size={12} />
                            <span>{formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Admin Delete Action */}
                      {isEmirgan && (
                        <button
                          onClick={() => handleDelete(ann.id)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                          title="Duyuruyu Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Announcement Title */}
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-3">
                      {ann.title}
                    </h2>

                    {/* Rich HTML Content */}
                    <div
                      className={`${sizeClass} ${weightClass} text-slate-700 dark:text-slate-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words`}
                      style={{ color: customColor }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target && target.tagName === "IMG" && (target as HTMLImageElement).src) {
                          setLightboxImageUrl((target as HTMLImageElement).src);
                        }
                      }}
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(ann.content, sanitizeOptions)
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Lightbox Photo Viewer Modal */}
      {lightboxImageUrl && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150 select-none"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center p-2">
            <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
              <a
                href={lightboxImageUrl}
                download="duyuru_fotografi.jpg"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 transition-all shadow-md cursor-pointer"
                title="İndir"
              >
                <Download size={18} />
              </a>
              <button
                type="button"
                onClick={() => setLightboxImageUrl(null)}
                className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 transition-all cursor-pointer shadow-md"
                title="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            <img
              src={lightboxImageUrl}
              alt="Duyuru Fotoğrafı Büyük Boyut"
              className="max-w-full max-h-[85vh] rounded-3xl object-contain shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
