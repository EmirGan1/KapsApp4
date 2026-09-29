import React, { useState, useEffect, useMemo } from "react";
import { X, Check, Shield, Sparkles, Tag, AlertCircle, RefreshCw, Layers, Trash2, Award } from "lucide-react";
import { COURSE_ROLES, CourseRole, sortRolesByPosition } from "../types";
import { getApiUrl, getAuthHeaders } from "../utils/api";
import { Socket } from "socket.io-client";

interface EditRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  username: string;
  currentRoles?: string[];
  socket?: Socket | null;
  onRolesUpdated?: (newRoles: string[]) => void;
}

export default function EditRolesModal({
  isOpen,
  onClose,
  userId,
  username,
  currentRoles = [],
  socket,
  onRolesUpdated
}: EditRolesModalProps) {
  const [availableRoles, setAvailableRoles] = useState<CourseRole[]>(COURSE_ROLES);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch all roles (including custom roles & order from backend)
  const loadRoles = () => {
    fetch(getApiUrl("/api/roles"))
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.roles) && data.roles.length > 0) {
          // Merge with static metadata like subjectGroup and level
          const merged: CourseRole[] = data.roles.map((r: any) => {
            const staticMatch = COURSE_ROLES.find(
              (cr) => cr.id.toLowerCase() === r.key.toLowerCase() || cr.id.toLowerCase() === r.id.toLowerCase()
            );
            return {
              id: r.key || r.id,
              key: r.key || r.id,
              label: r.name || r.label,
              name: r.name || r.label,
              color: r.color,
              position: Number(r.position) || 0,
              isCustom: Boolean(r.isCustom),
              description: r.description || staticMatch?.description,
              subjectGroup: staticMatch?.subjectGroup || (r.isCustom ? "custom" : undefined),
              level: staticMatch?.level
            };
          });
          setAvailableRoles(merged.sort((a, b) => (b.position || 0) - (a.position || 0)));
        }
      })
      .catch(() => {
        setAvailableRoles(COURSE_ROLES);
      });
  };

  useEffect(() => {
    if (isOpen) {
      loadRoles();
      setSelectedRoles(Array.isArray(currentRoles) ? Array.from(new Set(currentRoles)) : []);
      setErrorMessage("");
      setSuccessMessage("");
    }
  }, [isOpen, currentRoles]);

  useEffect(() => {
    if (!socket) return;
    const onRolesChanged = () => loadRoles();
    socket.on("roles:updated", onRolesChanged);
    return () => {
      socket.off("roles:updated", onRolesChanged);
    };
  }, [socket]);

  if (!isOpen) return null;

  // Toggle role with Smart SL / HL Conflict resolution
  const handleToggleRole = (role: CourseRole) => {
    setSelectedRoles((prev) => {
      const isSelected = prev.includes(role.id);

      if (isSelected) {
        // Unselecting
        return prev.filter((id) => id !== role.id);
      } else {
        // Selecting: If this role belongs to a subject group with SL/HL level, remove the conflicting level
        let next = [...prev];
        if (role.subjectGroup && role.level) {
          const conflictingRole = availableRoles.find(
            (r) => r.subjectGroup === role.subjectGroup && r.id !== role.id
          );
          if (conflictingRole) {
            next = next.filter((id) => id !== conflictingRole.id);
          }
        }
        next.push(role.id);
        return next;
      }
    });
  };

  const handleSelectDefaults = () => {
    setSelectedRoles(["titc", "eng_b_hl"]);
  };

  const handleClearAll = () => {
    setSelectedRoles([]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    // Fully flexible: save exactly what is selected without forced additions
    const rolesToSave = Array.from(new Set([...selectedRoles]));

    try {
      // 1. REST API update
      const res = await fetch(getApiUrl(`/api/users/${userId}/roles`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ roles: rolesToSave })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Roller güncellenirken hata oluştu.");
      }

      // 2. Socket update broadcast for instant reactivity
      if (socket && socket.connected) {
        socket.emit("update_user_roles", { targetUserId: userId, roles: rolesToSave });
      }

      if (onRolesUpdated) {
        onRolesUpdated(rolesToSave);
      }

      setSuccessMessage("Roller başarıyla kaydedildi!");
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      console.error("Save roles error:", err);
      setErrorMessage(err.message || "Roller kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  // Categorize standard IB subject groups and custom roles
  const coreRoles = availableRoles.filter((r) => r.id === "titc" || r.id === "eng_b_hl");
  const subjectGroups = [
    { title: "English B", roles: availableRoles.filter((r) => r.subjectGroup === "english" && r.id !== "eng_b_hl") },
    { title: "Turkish A", roles: availableRoles.filter((r) => r.subjectGroup === "turkish") },
    { title: "Mathematics", roles: availableRoles.filter((r) => r.subjectGroup === "math") },
    { title: "Physics", roles: availableRoles.filter((r) => r.subjectGroup === "physics") },
    { title: "Digital Society", roles: availableRoles.filter((r) => r.subjectGroup === "digital_society" || r.id.startsWith("digital_society")) },
    { title: "Psychology", roles: availableRoles.filter((r) => r.subjectGroup === "psychology") },
    { title: "Chemistry", roles: availableRoles.filter((r) => r.subjectGroup === "chemistry") },
    { title: "Biology", roles: availableRoles.filter((r) => r.subjectGroup === "biology") }
  ].filter((g) => g.roles.length > 0);

  // Custom Created Roles
  const customRoles = availableRoles.filter((r) => r.isCustom || (!r.subjectGroup && r.id !== "titc" && r.id !== "eng_b_hl"));

  // Sorted active roles for Discord preview
  const sortedActiveRoles = useMemo(() => {
    return sortRolesByPosition(selectedRoles, availableRoles);
  }, [selectedRoles, availableRoles]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white flex items-center gap-2">
                Kullanıcı Rolleri Yönetimi
              </h3>
              <p className="text-xs text-slate-400">
                <span className="text-indigo-400 font-semibold">@{username}</span> kullanıcısının ders ve özel rozetleri
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 scrollbar-thin scrollbar-thumb-slate-700">
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <Check size={16} className="shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Discord Live Preview Section */}
          <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-semibold text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-400" />
                Discord Profil Önizlemesi ({selectedRoles.length} Rol)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectDefaults}
                  className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                >
                  Varsayılanları Seç
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                >
                  Tümünü Temizle
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-h-[34px] p-2 bg-slate-900/90 rounded-xl border border-slate-800">
              {sortedActiveRoles.length === 0 ? (
                <span className="text-xs text-slate-500 italic">Hiçbir rol seçilmedi (0 Rol)</span>
              ) : (
                sortedActiveRoles.map((role) => (
                  <div
                    key={role.id}
                    style={{
                      backgroundColor: `${role.color}1A`,
                      borderColor: `${role.color}4D`
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shadow-xs"
                    title={`Hiyerarşi Sırası: ${role.position || 0}`}
                  >
                    <span
                      style={{
                        backgroundColor: role.color,
                        boxShadow: `0 0 6px ${role.color}80`
                      }}
                      className="w-2 h-2 rounded-full shrink-0"
                    />
                    <span className="text-slate-100">{role.label || role.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-400">
              Dersleri tek tek tıklayarak ekleyin veya kaldırın:
            </span>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-semibold transition-colors cursor-pointer ml-auto"
            >
              Tümünü Temizle
            </button>
          </div>

          {/* 1. Core IB Roles (TITC & English B HL) - Now fully toggleable */}
          {coreRoles.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Layers size={13} className="text-rose-400" />
                <span>Temel IB Dersleri (İsteğe Bağlı Kaldırılabilir)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {coreRoles.map((role) => {
                  const isSelected = selectedRoles.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleToggleRole(role)}
                      style={{
                        borderColor: isSelected ? role.color : undefined,
                        backgroundColor: isSelected ? `${role.color}18` : undefined
                      }}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? "border-2 shadow-md shadow-slate-950"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          style={{ backgroundColor: role.color }}
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        />
                        <div>
                          <p className="font-bold text-sm text-white">{role.label}</p>
                          <p className="text-[10px] text-slate-400">Ders Rolü (Sıra: {role.position || 0})</p>
                        </div>
                      </div>
                      <div
                        style={{ backgroundColor: isSelected ? role.color : undefined }}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                          isSelected ? "border-transparent text-white" : "border-slate-700 text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Custom Roles Created by Emirgan */}
          {customRoles.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Award size={13} className="text-amber-400" />
                <span>Özel Oluşturulmuş Roller</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customRoles.map((role) => {
                  const isSelected = selectedRoles.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleToggleRole(role)}
                      style={{
                        borderColor: isSelected ? role.color : undefined,
                        backgroundColor: isSelected ? `${role.color}18` : undefined
                      }}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? "border-2 shadow-md shadow-slate-950"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          style={{ backgroundColor: role.color }}
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{role.label || role.name}</p>
                          <p className="text-[10px] text-amber-400/90 truncate">Özel Rol (Sıra: {role.position || 0})</p>
                        </div>
                      </div>
                      <div
                        style={{ backgroundColor: isSelected ? role.color : undefined }}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                          isSelected ? "border-transparent text-white" : "border-slate-700 text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Elective IB Subject Groups (SL / HL Smart Switch) */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Seçmeli IB Dersleri (SL / HL Otomatik Geçiş)</span>
              <span className="text-[10px] text-slate-500 font-normal lowercase">Aynı dersin SL/HL seçenekleri birbirini otomatik dengeler</span>
            </div>

            <div className="space-y-2.5">
              {subjectGroups.map((group) => (
                <div key={group.title} className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80">
                  <p className="text-xs font-semibold text-slate-300 mb-2 px-1">{group.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.roles.map((role) => {
                      const isSelected = selectedRoles.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => handleToggleRole(role)}
                          style={{
                            borderColor: isSelected ? role.color : undefined,
                            backgroundColor: isSelected ? `${role.color}18` : undefined
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                            isSelected
                              ? "border-2 shadow-md shadow-slate-950"
                              : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <span
                              style={{ backgroundColor: role.color }}
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                            />
                            <span className="font-semibold text-xs text-slate-100 truncate">{role.label}</span>
                          </div>
                          <div
                            style={{ backgroundColor: isSelected ? role.color : undefined }}
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-transparent text-white" : "border-slate-700 text-transparent"
                            }`}
                          >
                            <Check size={10} strokeWidth={3} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Vazgeç
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Rolleri Kaydet ({selectedRoles.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
