import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Users, 
  Calendar, 
  Globe, 
  Loader2, 
  Clock, 
  Info, 
  ShieldCheck, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { CourseFileItem } from './CourseFilesManager';

export interface DownloadLogEntry {
  id: number;
  file_id: number;
  user_id: number | null;
  username: string;
  downloaded_at: string;
  ip_address: string | null;
  user_avatar: string | null;
  user_color: string | null;
  user_role: string | null;
}

export interface DownloadLogsResponse {
  file_id: number;
  original_name: string;
  total_downloads: number;
  unique_downloaders_count: number;
  pre_feature_count: number;
  logs: DownloadLogEntry[];
}

export interface DownloadHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: CourseFileItem | null;
}

export const DownloadHistoryModal: React.FC<DownloadHistoryModalProps> = ({
  isOpen,
  onClose,
  file
}) => {
  const [logsData, setLogsData] = useState<DownloadLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  // Fetch download logs when modal opens
  useEffect(() => {
    if (!isOpen || !file) {
      setLogsData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || "";
        const username = localStorage.getItem("lan_username") || localStorage.getItem("username") || "emirgan";

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (username) headers["X-Username"] = username;

        const res = await fetch(getApiUrl(`/api/files/${file.id}/download-logs`), {
          headers
        });

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("Bu işlem için yetkiniz bulunmamaktadır. Yalnızca emirgan veya ROOT görebilir.");
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `İndirme günlüğü alınamadı (${res.status})`);
        }

        const data: DownloadLogsResponse = await res.json();
        if (isMounted) {
          setLogsData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "İndirme geçmişi yüklenirken bir sorun oluştu.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  // Format date and relative time
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return { dateStr: "Bilinmiyor", relStr: "" };
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { dateStr: isoString, relStr: "" };

      const dateStr = d.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const now = Date.now();
      const diffMs = now - d.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      let relStr = "";
      if (diffMinutes < 1) relStr = "Az önce";
      else if (diffMinutes < 60) relStr = `${diffMinutes} dk önce`;
      else if (diffHours < 24) relStr = `${diffHours} saat önce`;
      else if (diffDays < 7) relStr = `${diffDays} gün önce`;

      return { dateStr, relStr };
    } catch {
      return { dateStr: String(isoString), relStr: "" };
    }
  };

  const fileName = file.original_name || file.filename || "Adsız Dosya";
  const totalDownloads = logsData?.total_downloads ?? file.download_count ?? 0;
  const uniqueUsers = logsData?.unique_downloaders_count ?? 0;
  const preFeatureCount = logsData?.pre_feature_count ?? 0;
  const logsList = logsData?.logs ?? [];

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden pb-safe animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-slate-800/80 bg-slate-900/90 shrink-0">
          <div className="flex items-start gap-3 min-w-0 pr-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0 mt-0.5">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  İndirme Geçmişi & Audit Log
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Emirgan / ROOT</span>
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 truncate" title={fileName}>
                {fileName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Kapat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="px-5 sm:px-6 py-3 bg-slate-950/50 border-b border-slate-800/60 flex items-center justify-between text-xs font-medium text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Download size={14} className="text-sky-400" />
              <span>Toplam <strong className="font-mono text-sky-300 font-bold">{totalDownloads}</strong> İndirme</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Users size={14} className="text-emerald-400" />
              <span><strong className="font-mono text-emerald-300 font-bold">{uniqueUsers}</strong> Tekil Kullanıcı</span>
            </div>
          </div>

          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Son 100 işlem kaydı
          </span>
        </div>

        {/* Modal Body / Scrollable Logs */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-sky-500" />
              <p className="text-xs font-semibold">İndirme günlüğü yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center space-y-2">
              <AlertCircle size={28} className="mx-auto text-rose-400" />
              <p className="text-xs sm:text-sm font-semibold">{error}</p>
            </div>
          ) : logsList.length === 0 && preFeatureCount === 0 ? (
            <div className="py-14 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-500">
                <FileText size={24} />
              </div>
              <p className="text-sm font-bold text-slate-300">Bu dosya henüz indirilmedi</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Kullanıcılar dosyayı indirdiğinde kullanıcı adı, zaman damgası ve IP kaydı bu listede yer alacaktır.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {logsList.map((log) => {
                const { dateStr, relStr } = formatDateTime(log.downloaded_at);
                const isUnameEmirgan = log.username?.toLowerCase() === 'emirgan';
                const initial = (log.username || "?").substring(0, 2).toUpperCase();

                return (
                  <div 
                    key={log.id}
                    className="p-3 sm:p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/50 hover:border-slate-700 transition-all flex items-center justify-between gap-3 shadow-xs"
                  >
                    {/* Left: Avatar + Username + IP */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {log.user_avatar ? (
                          <img 
                            src={log.user_avatar} 
                            alt={log.username}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-700" 
                          />
                        ) : (
                          <div 
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-xs"
                            style={{ backgroundColor: log.user_color || '#3b82f6' }}
                          >
                            {initial}
                          </div>
                        )}
                        {isUnameEmirgan && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-[8px] font-black rounded-full flex items-center justify-center text-slate-950">
                            ★
                          </span>
                        )}
                      </div>

                      {/* User details */}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-200 hover:text-sky-400 transition-colors truncate">
                            {log.username ? `@${log.username}` : '@Anonim'}
                          </span>
                          {isUnameEmirgan && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ROOT
                            </span>
                          )}
                          {log.user_role === 'ADMIN' && !isUnameEmirgan && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              ADMIN
                            </span>
                          )}
                        </div>

                        {/* IP Address */}
                        {log.ip_address && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                            <Globe size={11} className="text-slate-500" />
                            <span>{log.ip_address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Timestamp */}
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="text-xs font-medium text-slate-300 flex items-center gap-1 justify-end">
                        <Clock size={12} className="text-slate-500" />
                        <span>{dateStr}</span>
                      </div>
                      {relStr && (
                        <div className="text-[10px] text-slate-500">
                          {relStr}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Historical Pre-Feature Downloads Card */}
              {preFeatureCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 flex items-start gap-3 mt-3">
                  <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-amber-300">
                      Özellik öncesi anonim indirmeler: {preFeatureCount} adet
                    </p>
                    <p className="text-amber-200/80 leading-relaxed text-[11px]">
                      Bu dosya detaylı indirme günlüğü (audit log) sistemi devreye girmeden önce {preFeatureCount} kez indirilmiştir. Toplam sayaç korunmuştur.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Yalnızca yetkili yönetici paneli görünümü</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadHistoryModal;
