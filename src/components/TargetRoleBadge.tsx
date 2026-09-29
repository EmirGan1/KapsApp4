import React from "react";
import { parseTargetRoles, COURSE_ROLES, CourseRole } from "../types";
import { Globe, Target } from "lucide-react";

interface TargetRoleBadgeProps {
  targetRolesRaw: any;
  className?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export default function TargetRoleBadge({
  targetRolesRaw,
  className = "",
  size = "sm",
  showIcon = true
}: TargetRoleBadgeProps) {
  const targetRoles = parseTargetRoles(targetRolesRaw);
  const isEveryone = targetRoles.length === 0 || targetRoles.includes("all");

  const sizeStyles = {
    sm: {
      pill: "px-2 py-0.5 text-[11px] gap-1",
      dot: "w-1.5 h-1.5",
      text: "text-[11px]"
    },
    md: {
      pill: "px-2.5 py-1 text-xs gap-1.5",
      dot: "w-2 h-2",
      text: "text-xs font-semibold"
    }
  }[size];

  if (isEveryone) {
    return (
      <div className={`inline-flex items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-semibold ${sizeStyles.pill} ${className}`}>
        {showIcon && <Globe size={size === "sm" ? 12 : 14} className="shrink-0" />}
        <span>Herkes</span>
      </div>
    );
  }

  const activeRoles: CourseRole[] = COURSE_ROLES.filter((r) => targetRoles.includes(r.id));

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {showIcon && (
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 inline-flex items-center gap-0.5">
          <Target size={12} className="text-indigo-500" />
        </span>
      )}
      {activeRoles.map((role) => (
        <div
          key={role.id}
          style={{
            backgroundColor: `${role.color}1A`,
            borderColor: `${role.color}4D`,
          }}
          className={`inline-flex items-center rounded-lg border select-none transition-all ${sizeStyles.pill}`}
          title={`Hedef Ders: ${role.label}`}
        >
          <span
            style={{
              backgroundColor: role.color,
              boxShadow: `0 0 4px ${role.color}80`
            }}
            className={`${sizeStyles.dot} rounded-full shrink-0`}
          />
          <span className={`text-slate-800 dark:text-slate-200 font-semibold ${sizeStyles.text}`}>
            {role.label}
          </span>
        </div>
      ))}
    </div>
  );
}
