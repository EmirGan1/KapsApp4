import React from "react";
import { COURSE_ROLES, CourseRole } from "../types";
import { Globe, Users, Check, Sparkles, X, ShieldAlert, Layers } from "lucide-react";

interface TargetRoleSelectorProps {
  selectedRoles: string[];
  onChange: (roles: string[]) => void;
  className?: string;
  label?: string;
}

export default function TargetRoleSelector({
  selectedRoles,
  onChange,
  className = "",
  label = "Kimler Görebilir? (Hedef Ders Rolleri)"
}: TargetRoleSelectorProps) {
  // If selectedRoles is empty -> means "Everyone"
  const isEveryone = selectedRoles.length === 0 || selectedRoles.includes("all");

  const handleSetEveryone = () => {
    onChange([]);
  };

  const handleToggleRole = (roleId: string) => {
    if (isEveryone) {
      onChange([roleId]);
      return;
    }

    if (selectedRoles.includes(roleId)) {
      const next = selectedRoles.filter((id) => id !== roleId);
      onChange(next);
    } else {
      onChange([...selectedRoles, roleId]);
    }
  };

  const handleSelectDefaults = () => {
    onChange(["titc", "eng_b_hl"]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className={`space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Users size={16} className="text-indigo-500" />
          <span>{label}</span>
        </label>

        {/* Visibility summary badge */}
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
          isEveryone 
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
        }`}>
          {isEveryone ? "🌐 Herkese Açık (Tüm Kullanıcılar)" : `🎯 ${selectedRoles.length} Özel Ders Rolü`}
        </span>
      </div>

      {/* Main Choice: Everyone vs Custom Roles */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleSetEveryone}
          className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            isEveryone
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50"
          }`}
        >
          <Globe size={15} />
          <span>Herkes (Tüm Kullanıcılar)</span>
          {isEveryone && <Check size={14} className="ml-auto" />}
        </button>

        <button
          type="button"
          onClick={() => {
            if (isEveryone) {
              onChange(["titc", "eng_b_hl"]);
            }
          }}
          className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            !isEveryone
              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-500/50"
          }`}
        >
          <Sparkles size={15} />
          <span>Belirli Ders Rolleri</span>
          {!isEveryone && <Check size={14} className="ml-auto" />}
        </button>
      </div>

      {/* Course role selection when custom is active */}
      {!isEveryone && (
        <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Dersleri tek tek seçerek hedefleyin:
            </span>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
            >
              <X size={12} />
              <span>Herkes Yap</span>
            </button>
          </div>

          {/* Grid of Course Roles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {COURSE_ROLES.map((role) => {
              const isSelected = selectedRoles.includes(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleToggleRole(role.id)}
                  style={{
                    backgroundColor: isSelected ? `${role.color}26` : undefined,
                    borderColor: isSelected ? role.color : undefined,
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "shadow-2xs font-bold"
                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 font-medium"
                  }`}
                >
                  <span
                    style={{
                      backgroundColor: role.color,
                      boxShadow: isSelected ? `0 0 8px ${role.color}99` : "none"
                    }}
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                  />
                  <span className="text-xs text-slate-800 dark:text-slate-200 truncate flex-1">
                    {role.label}
                  </span>
                  {isSelected && (
                    <Check size={13} style={{ color: role.color }} className="shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
