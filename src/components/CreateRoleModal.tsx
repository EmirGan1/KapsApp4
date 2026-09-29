import React, { useState, useEffect, useMemo } from "react";
import { X, Sparkles, Plus, Award, Check, Layers, ArrowUp } from "lucide-react";
import { COURSE_ROLES, CourseRole } from "../types";
import { getApiUrl, getAuthHeaders } from "../utils/api";
import { Socket } from "socket.io-client";

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRoles?: CourseRole[];
  socket?: Socket | null;
  onRoleCreated?: (newRole: CourseRole) => void;
}

const DISCORD_COLOR_PALETTE = [
  "#EF4444", // Kırmızı (Red)
  "#F97316", // Turuncu (Orange)
  "#F59E0B", // Amber / Altın (Gold)
  "#10B981", // Zümrüt Yeşili (Emerald)
  "#14B8A6", // Teal
  "#06B6D4", // Camgöbeği (Cyan - Digital Society SL)
  "#0891B2", // Koyu Camgöbeği (Cyan - Digital Society HL)
  "#0284C7", // Gök Mavisi (Sky Blue)
  "#3B82F6", // Mavi (Blue)
  "#6366F1", // İndigo (Indigo)
  "#8B5CF6", // Menekşe (Violet)
  "#A855F7", // Mor (Purple)
  "#EC4899", // Pembe (Pink)
  "#E11D48", // Gül / Koyu Kırmızı (Rose - TITC)
  "#64748B", // Çelik / Gri (Slate)
  "#94A3B8"  // Gümüş (Silver)
];

export default function CreateRoleModal({
  isOpen,
  onClose,
  existingRoles = COURSE_ROLES,
  socket,
  onRoleCreated
}: CreateRoleModalProps) {
  const [roleName, setRoleName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [roleColor, setRoleColor] = useState("#F59E0B");
  const [aboveRoleId, setAboveRoleId] = useState<string>("top"); // "top" | "bottom" | specific role id
  const [position, setPosition] = useState<number>(105);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Sort existing roles by position descending
  const sortedExistingRoles = useMemo(() => {
    return [...existingRoles].sort((a, b) => (b.position || 0) - (a.position || 0));
  }, [existingRoles]);

  // Recalculate position whenever aboveRoleId changes
  useEffect(() => {
    if (aboveRoleId === "top") {
      const maxPos = sortedExistingRoles.length > 0 
        ? Math.max(...sortedExistingRoles.map((r) => r.position || 0))
        : 100;
      setPosition(maxPos + 5);
    } else if (aboveRoleId === "bottom") {
      const minPos = sortedExistingRoles.length > 0 
        ? Math.min(...sortedExistingRoles.map((r) => r.position || 0))
        : 10;
      setPosition(Math.max(1, minPos - 5));
    } else {
      const targetRole = sortedExistingRoles.find((r) => r.id === aboveRoleId || r.key === aboveRoleId);
      if (targetRole) {
        setPosition((targetRole.position || 0) + 1);
      }
    }
  }, [aboveRoleId, sortedExistingRoles]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setRoleName("");
      setRoleKey("");
      setRoleColor("#F59E0B");
      setAboveRoleId("top");
      setDescription("");
      setErrorMessage("");
      const maxPos = sortedExistingRoles.length > 0 
        ? Math.max(...sortedExistingRoles.map((r) => r.position || 0))
        : 100;
      setPosition(maxPos + 5);
    }
  }, [isOpen, sortedExistingRoles]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setRoleName(val);
    const autoKey = val.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
    setRoleKey(autoKey);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setErrorMessage("Rol adı zorunludur.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const finalKey = roleKey.trim() || roleName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

    try {
      const res = await fetch(getApiUrl("/api/admin/roles"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: roleName.trim(),
          key: finalKey,
          color: roleColor,
          position: Number(position) || 50,
          description: description.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Rol oluşturulamadı.");
      }

      if (socket && socket.connected) {
        socket.emit("roles:updated");
        socket.emit("roles_updated");
      }

      if (onRoleCreated && data.role) {
        onRoleCreated(data.role);
      }

      onClose();
    } catch (err: any) {
      console.error("Create role error:", err);
      setErrorMessage(err.message || "Rol oluşturulurken hata meydana geldi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">
              <Award size={20} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white flex items-center gap-2">
                <span>Yeni Özel Rol Oluştur</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Discord Tarzı
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Kullanıcılara atanabilecek yeni özel unvan ve renk rozeti oluşturun
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin scrollbar-thumb-slate-700 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-950/70 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* 1. Rol Adı */}
          <div>
            <label className="block text-slate-200 font-bold mb-1.5">
              Rol Adı (Title / Name) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Örn: Yönetici, Moderatör, Öğrenci Temsilcisi, Kulüp Başkanı"
              value={roleName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-semibold"
              required
              autoFocus
            />
          </div>

          {/* 2. Benzersiz Slug / Key */}
          <div>
            <label className="block text-slate-200 font-bold mb-1.5">
              Benzersiz Rol Kodu / ID (Key)
            </label>
            <input
              type="text"
              placeholder="Örn: student_rep, moderator, club_lead"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Sistem ve API tarafında kullanılacak benzersiz slug tanımlayıcı.</p>
          </div>

          {/* 3. Rol Rengi (Palette + Color Picker + Hex) */}
          <div>
            <label className="block text-slate-200 font-bold mb-1.5 flex items-center justify-between">
              <span>Rol Rengi (Discord Tarzı Renk Paleti)</span>
              <span className="font-mono text-[11px] text-indigo-400 font-bold">{roleColor}</span>
            </label>
            
            {/* Color preview bar + manual inputs */}
            <div className="flex items-center gap-2 mb-2.5">
              <input
                type="color"
                value={roleColor}
                onChange={(e) => setRoleColor(e.target.value)}
                className="w-10 h-10 rounded-xl border border-slate-700 bg-slate-950 cursor-pointer p-0.5 shrink-0"
              />
              <input
                type="text"
                value={roleColor}
                onChange={(e) => setRoleColor(e.target.value)}
                placeholder="#F59E0B"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs uppercase focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Predefined Discord Palette */}
            <div className="grid grid-cols-8 gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
              {DISCORD_COLOR_PALETTE.map((hex) => {
                const isSelected = roleColor.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setRoleColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={`h-7 rounded-lg transition-transform cursor-pointer relative flex items-center justify-center ${
                      isSelected ? "scale-110 ring-2 ring-white shadow-md" : "hover:scale-105 opacity-85 hover:opacity-100"
                    }`}
                    title={hex}
                  >
                    {isSelected && <Check size={13} className="text-white drop-shadow-md" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Hiyerarşi & Sıralama (Hangi rolün üstünde yer alsın?) */}
          <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Layers size={14} className="text-indigo-400" />
              <span>Hiyerarşi & Görünüm Sırası (Discord Tarzı)</span>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                Hangi rolün üstünde yer alsın?
              </label>
              <select
                value={aboveRoleId}
                onChange={(e) => setAboveRoleId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="top">🔝 En Üstte (Tüm Rollerin En Üzerinde / En Yüksek Hiyerarşi)</option>
                {sortedExistingRoles.map((r) => (
                  <option key={r.id || r.key} value={r.id || r.key}>
                    ⬆ {r.label || r.name} rolünün hemen üstünde (Hiyerarşi: {(r.position || 0) + 1})
                  </option>
                ))}
                <option value="bottom">🔻 En Altta (En Düşük Hiyerarşi)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">Hesaplanan Pozisyon Değeri:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={position}
                  onChange={(e) => setPosition(Number(e.target.value) || 0)}
                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-amber-400 text-xs focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500">(Büyük olan üstte)</span>
              </div>
            </div>
          </div>

          {/* 5. Rol Açıklaması */}
          <div>
            <label className="block text-slate-200 font-bold mb-1.5">
              Rol Açıklaması (İsteğe Bağlı)
            </label>
            <input
              type="text"
              placeholder="Örn: 2026 Dönem Öğrenci Temsilciliği ve Etkinlik Koordinasyonu"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Discord Rozet Önizlemesi */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discord Profil Rozet Önizlemesi</p>
            <div className="flex items-center gap-2 flex-wrap">
              <div
                style={{
                  backgroundColor: `${roleColor}20`,
                  borderColor: `${roleColor}60`
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold shadow-xs"
              >
                <span
                  style={{
                    backgroundColor: roleColor,
                    boxShadow: `0 0 8px ${roleColor}99`
                  }}
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                />
                <span className="text-white">{roleName.trim() || "Yeni Rol"}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                (Hiyerarşi: {position})
              </span>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !roleName.trim()}
              className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus size={15} />
              <span>{isSubmitting ? "Oluşturuluyor..." : "Rolü Oluştur ve Kaydet"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
