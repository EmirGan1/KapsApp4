import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { getApiUrl, getAuthHeaders } from "../utils/api";

type Metrics = {
  sampledAt: string;
  cpuPercent: number | null;
  cores: number;
  loadAverage: number | null;
  memory: { used: number; total: number };
  disk: { used: number; available: number; total: number } | null;
  uptimeSeconds: number;
  appUptimeSeconds: number;
  nodeVersion: string;
};

const gib = (bytes: number) => `${(bytes / 1024 ** 3).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GiB`;
const percent = (used: number, total: number) => total > 0 ? Math.round(100 * used / total) : null;

function duration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  return days ? `${days} gün ${hours} sa` : hours ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
}

export default function AdminServerStatus({ refreshKey }: { refreshKey: number }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(getApiUrl("/api/admin/server-metrics"), {
        headers: getAuthHeaders(), cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Metrics unavailable");
      const next: Metrics = await response.json();
      if (request.current === controller) {
        setMetrics(next);
        setError(false);
      }
    } catch {
      if (request.current === controller) setError(true);
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(onVisible, 10000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh, refreshKey]);

  const meters = [
    { label: "CPU", icon: Cpu, value: metrics?.cpuPercent ?? null,
      detail: metrics ? `${metrics.cores} mantıksal çekirdek${metrics.loadAverage == null ? "" : ` · Yük ${metrics.loadAverage.toFixed(2)}`}` : null },
    { label: "Bellek", icon: MemoryStick, value: metrics ? percent(metrics.memory.used, metrics.memory.total) : null,
      detail: metrics ? `${gib(metrics.memory.used)} / ${gib(metrics.memory.total)}` : null },
    { label: "Disk", icon: HardDrive, value: metrics?.disk ? percent(metrics.disk.used, metrics.disk.total) : null,
      detail: metrics?.disk ? `${gib(metrics.disk.available)} boş` : null },
  ];

  return (
    <aside aria-label="Sunucu durumu" className="min-w-0 rounded-2xl border border-white/10 bg-[#121823] px-3 py-2 lg:p-4">
      <div className="mb-2 flex items-center justify-between gap-2 lg:mb-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-white lg:text-sm">
          <Activity size={15} className="text-teal-300" aria-hidden="true" /> Sunucu durumu
        </h2>
        <span className={`text-[11px] tabular-nums ${error ? "text-amber-300" : "text-slate-400"}`}>
          {error ? (metrics ? "Veri güncel değil" : "Bağlantı yok") :
            metrics ? new Date(metrics.sampledAt).toLocaleTimeString("tr-TR") : "Ölçülüyor"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-4">
        {meters.map(({ label, icon: Icon, value, detail }) => (
          <div key={label} className="min-w-0">
            <div className="flex items-center justify-between gap-1 text-[11px] lg:text-sm">
              <span className="flex items-center gap-1 text-slate-300"><Icon size={13} aria-hidden="true" />{label}</span>
              <span className="font-semibold tabular-nums text-white">{value == null ? "—" : `%${value}`}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-700/70 lg:mt-2 lg:h-1.5"
              role={value == null ? undefined : "meter"} aria-label={label}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
              <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${(value ?? 0) >= 90 ? "bg-amber-400" : "bg-teal-300"}`}
                style={{ width: `${Math.min(100, value ?? 0)}%` }} />
            </div>
            {detail && <p className="mt-1 hidden text-xs tabular-nums text-slate-400 lg:block">{detail}</p>}
          </div>
        ))}
      </div>
      {metrics && (
        <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-[11px] text-slate-400 lg:mt-4 lg:grid lg:gap-2 lg:pt-3 lg:text-xs">
          <div className="flex justify-between gap-1"><dt>Sunucu</dt><dd className="text-slate-200">{duration(metrics.uptimeSeconds)}</dd></div>
          <div className="hidden justify-between gap-1 lg:flex"><dt>Uygulama</dt><dd className="text-slate-200">{duration(metrics.appUptimeSeconds)}</dd></div>
          <div className="flex justify-between gap-1"><dt>Node.js</dt><dd className="text-slate-200">{metrics.nodeVersion}</dd></div>
        </dl>
      )}
    </aside>
  );
}
