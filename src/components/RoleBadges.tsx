import React, { useState, useEffect } from "react";
import { COURSE_ROLES, CourseRole, sortRolesByPosition } from "../types";
import { ShieldCheck, Plus, Sparkles, Tag } from "lucide-react";
import { getApiUrl } from "../utils/api";

interface RoleBadgesProps {
  roles?: string[] | null;
  allRoles?: CourseRole[];
  showEditButton?: boolean;
  onEditClick?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  emptyText?: string;
}

let cachedGlobalRoles: CourseRole[] = COURSE_ROLES;

export default function RoleBadges({
  roles,
  allRoles,
  showEditButton = false,
  onEditClick,
  size = "md",
  className = "",
  emptyText = ""
}: RoleBadgesProps) {
  const [activeRoleDefs, setActiveRoleDefs] = useState<CourseRole[]>(allRoles || cachedGlobalRoles);

  useEffect(() => {
    if (allRoles && allRoles.length > 0) {
      setActiveRoleDefs(allRoles);
      cachedGlobalRoles = allRoles;
      return;
    }

    // If no explicit allRoles passed, fetch from backend roles registry
    fetch(getApiUrl("/api/roles"))
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.roles) && data.roles.length > 0) {
          const merged: CourseRole[] = data.roles.map((r: any) => {
            const staticMatch = COURSE_ROLES.find(
              (cr) => cr.id.toLowerCase() === (r.key || r.id).toLowerCase()
            );
            return {
              id: r.key || r.id,
              key: r.key || r.id,
              label: r.name || r.label,
              name: r.name || r.label,
              color: r.color || "#6366F1",
              position: Number(r.position) || 0,
              isCustom: Boolean(r.isCustom),
              description: r.description || staticMatch?.description,
              subjectGroup: staticMatch?.subjectGroup || (r.isCustom ? "custom" : undefined),
              level: staticMatch?.level
            };
          });
          cachedGlobalRoles = merged;
          setActiveRoleDefs(merged);
        }
      })
      .catch(() => {});
  }, [allRoles]);

  // If roles is explicitly provided as array (including empty array []), respect it.
  const roleIds = Array.isArray(roles) ? roles : [];

  // Sort active roles by position descending (Discord-style hierarchy)
  const activeRoles: CourseRole[] = sortRolesByPosition(roleIds, activeRoleDefs);

  const sizeStyles = {
    sm: {
      pill: "px-2 py-0.5 text-[11px] gap-1.5",
      dot: "w-1.5 h-1.5",
      text: "text-[11px]"
    },
    md: {
      pill: "px-2.5 py-1 text-xs gap-2",
      dot: "w-2 h-2",
      text: "text-xs font-semibold"
    },
    lg: {
      pill: "px-3 py-1.5 text-sm gap-2.5",
      dot: "w-2.5 h-2.5",
      text: "text-sm font-semibold"
    }
  }[size];

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {activeRoles.map((role) => (
        <div
          key={role.id}
          style={{
            backgroundColor: `${role.color}1A`, // 10% opacity
            borderColor: `${role.color}4D`,     // 30% opacity
          }}
          className={`inline-flex items-center rounded-lg border transition-all duration-150 select-none shadow-2xs hover:scale-105 ${sizeStyles.pill}`}
          title={role.description || `${role.label || role.name} Rolü (Hiyerarşi Sırası: ${role.position || 0})`}
        >
          {/* Discord-style Glowing Role Circle Dot */}
          <span
            style={{
              backgroundColor: role.color,
              boxShadow: `0 0 6px ${role.color}80`
            }}
            className={`${sizeStyles.dot} rounded-full shrink-0`}
          />
          {/* Readable Course / Custom Role Label */}
          <span className={`text-slate-900 dark:text-slate-100 tracking-tight leading-none ${sizeStyles.text}`}>
            {role.label || role.name || role.id}
          </span>
        </div>
      ))}

      {activeRoles.length === 0 && Boolean(emptyText) && (
        <span className="text-xs text-slate-400 dark:text-slate-500 italic">{emptyText}</span>
      )}

      {/* Emirgan / Admin Role Edit Button */}
      {showEditButton && onEditClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs"
          title="Emirgan Rol Yönetimi: Kullanıcı Ders Rollerini Düzenle"
        >
          <Tag size={12} className="text-indigo-500" />
          <span>+ Rolleri Düzenle</span>
        </button>
      )}
    </div>
  );
}
