import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Download, 
  Users, 
  Globe, 
  Loader2, 
  Clock, 
  Info, 
  ShieldCheck, 
  FileText,
  AlertCircle,
  Hash,
  User,
  ListOrdered,
  Calendar
} from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { CourseFileItem } from './CourseFilesManager';

export interface UserDownloadSummaryItem {
  user_id: number | null;
  username: string;
  name: string | null;
  avatar: string | null;
  color: string | null;
  role: string | null;
  download_count: number;
  last_downloaded_at: string;
  first_downloaded_at: string;
  download_times: string[];
  ip_addresses: string[];
}

export interface DownloadLogEntry {
  id: number;
  file_id: number;
  user_id: number | null;
  username: string;
  name?: string | null;
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
  users_summary?: UserDownloadSummaryItem[];
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
  const [activeViewTab, setActiveViewTab] = useState<'users' | 'timeline'>('users');
  const [expandedUserKey, setExpandedUserKey] = useState<string | null>(null);

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
      setExpandedUserKey(null);
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

  // Format date and time
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return { dateStr: "Bilinmiyor", timeStr: "", fullStr: "Bilinmiyor", relStr: "" };
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { dateStr: isoString, timeStr: "", fullStr: isoString, relStr: "" };

      const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = d.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const fullStr = `${dateStr}, ${timeStr}`;

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

      return { dateStr, timeStr, fullStr, relStr };
    } catch {
      return { dateStr: String(isoString), timeStr: "", fullStr: String(isoString), relStr: "" };
    }
  };

  const fileName = file?.original_name || file?.filename || "Adsız Dosya";
  const totalDownloads = logsData?.total_downloads ?? file?.download_count ?? 0;
  const uniqueUsers = logsData?.unique_downloaders_count ?? 0;
  const preFeatureCount = logsData?.pre_feature_count ?? 0;
  const usersSummaryList = logsData?.users_summary ?? [];
  const logsList = logsData?.logs ?? [];

  if (!isOpen || !file) return null;

  return (
    <div 
      className="mobile-window fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden pb-safe animate-in zoom-in-95 duration-150"
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
                  Dosya İndirme Takip & Denetim Günlüğü
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Emirgan & ROOT Özel</span>
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

        {/* Stats Strip & Tab Buttons */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-slate-300 font-medium">
            <div className="flex items-center gap-1.5">
              <Download size={14} className="text-sky-400" />
              <span>Toplam <strong className="font-mono text-sky-300 font-bold">{totalDownloads}</strong> İndirme</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-emerald-400" />
              <span><strong className="font-mono text-emerald-300 font-bold">{uniqueUsers}</strong> Kullanıcı</span>
            </div>
          </div>

          {/* View Mode Toggle: Users Breakdown vs Full Timeline */}
          <div className="flex items-center p-1 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveViewTab('users')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewTab === 'users'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={13} />
              <span>Kullanıcılar ({usersSummaryList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('timeline')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewTab === 'timeline'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered size={13} />
              <span>Tüm İndirme Saatleri ({logsList.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={32} className="animate-spin text-sky-500" />
              <p className="text-xs font-bold">İndirme kayıtları yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center space-y-2">
              <AlertCircle size={28} className="mx-auto text-rose-400" />
              <p className="text-xs sm:text-sm font-semibold">{error}</p>
            </div>
          ) : logsList.length === 0 && preFeatureCount === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-500">
                <FileText size={24} />
              </div>
              <p className="text-sm font-bold text-slate-300">Bu dosya henüz indirilmedi</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Kullanıcılar dosyayı indirdiğinde kullanıcı adı, öğrenci/kullanıcı numarası, indirme sayısı ve tam indirme saatleri burada görüntülenecektir.
              </p>
            </div>
          ) : activeViewTab === 'users' ? (
            /* TAB 1: KULLANICI BAZLI ÖZET (Adı, Nosu, İndirme Sayısı, İndirme Saatleri) */
            <div className="space-y-3">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between px-1">
                <span>İndiren Kullanıcı Listesi (Kullanıcı Adı, No, İndirme Adedi ve Saatleri)</span>
                <span>{usersSummaryList.length} Kullanıcı</span>
              </div>

              {usersSummaryList.map((userSummary, index) => {
                const uKey = userSummary.user_id ? `u_id_${userSummary.user_id}` : `u_name_${userSummary.username}`;
                const isExpanded = expandedUserKey === uKey;
                const initial = (userSummary.username || "?").substring(0, 2).toUpperCase();
                const isEmirganUser = userSummary.username?.toLowerCase() === 'emirgan';
                const { fullStr: lastDownloadFull, relStr: lastDownloadRel } = formatDateTime(userSummary.last_downloaded_at);

                return (
                  <div
                    key={uKey}
                    className="p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/60 hover:border-slate-700 transition-all space-y-3 shadow-xs"
                  >
                    {/* Top Row: User Avatar, Name, No (#ID), and Download Count */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {userSummary.avatar ? (
                            <img 
                              src={userSummary.avatar} 
                              alt={userSummary.username}
                              className="w-10 h-10 rounded-2xl object-cover border border-slate-700" 
                            />
                          ) : (
                            <div 
                              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black text-white shadow-xs"
                              style={{ backgroundColor: userSummary.color || '#3b82f6' }}
                            >
                              {initial}
                            </div>
                          )}
                          {isEmirganUser && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-[9px] font-black rounded-full flex items-center justify-center text-slate-950">
                              ★
                            </span>
                          )}
                        </div>

                        {/* Name + No (#ID) */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-100 truncate">
                              {userSummary.name ? userSummary.name : `@${userSummary.username}`}
                            </span>
                            {userSummary.name && (
                              <span className="text-xs text-slate-400 font-mono">
                                @{userSummary.username}
                              </span>
                            )}
                            {isEmirganUser && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ROOT
                              </span>
                            )}
                            {userSummary.role === 'ADMIN' && !isEmirganUser && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                ADMIN
                              </span>
                            )}
                          </div>

                          {/* Kullanıcı Numarası / Nosu (#ID) */}
                          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            <span className="inline-flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-sky-400 font-bold">
                              <Hash size={11} className="text-sky-400" />
                              <span>No: #{userSummary.user_id !== null ? userSummary.user_id : 'Belirtilmedi'}</span>
                            </span>
                            {userSummary.ip_addresses[0] && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Globe size={11} />
                                <span>{userSummary.ip_addresses[0]}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* İndirme Sayısı Badge */}
                      <div className="text-right shrink-0">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-extrabold text-xs shadow-xs">
                          <Download size={13} className="text-sky-400" />
                          <span>{userSummary.download_count} Kez İndirdi</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Download Times & Details */}
                    <div className="pt-2 border-t border-slate-700/40 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-500" />
                        <span>Son İndirme Saati:</span>
                        <strong className="text-slate-200 font-mono font-bold">{lastDownloadFull}</strong>
                        {lastDownloadRel && (
                          <span className="text-slate-500 font-normal">({lastDownloadRel})</span>
                        )}
                      </div>

                      {/* Expand all download times button if downloaded more than once */}
                      {userSummary.download_times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExpandedUserKey(isExpanded ? null : uKey)}
                          className="text-sky-400 hover:text-sky-300 text-[11px] font-bold underline cursor-pointer"
                        >
                          {isExpanded ? "Saatleri Gizle" : `Tüm İndirme Saatlerini Gör (${userSummary.download_times.length})`}
                        </button>
                      )}
                    </div>

                    {/* Expanded list of all individual download timestamps for this user */}
                    {isExpanded && userSummary.download_times.length > 1 && (
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-1.5 animate-in fade-in duration-150">
                        <div className="text-[11px] font-bold text-slate-400">
                          {userSummary.username} Tarafından Yapılan Tüm İndirmelerin Saatleri:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {userSummary.download_times.map((tIso, tIdx) => {
                            const { fullStr, relStr } = formatDateTime(tIso);
                            return (
                              <div 
                                key={tIdx} 
                                className="flex items-center justify-between text-[11px] font-mono bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/40 text-slate-300"
                              >
                                <span>{tIdx + 1}. {fullStr}</span>
                                {relStr && <span className="text-slate-500 text-[10px]">{relStr}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* TAB 2: KRONOLOJİK ZAMAN ÇİZELGESİ (Tüm Tekil İndirme İşlemleri) */
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between px-1">
                <span>Her Bir İndirmenin Tam Tarih & Saati</span>
                <span>{logsList.length} Kayıt</span>
              </div>

              {logsList.map((log) => {
                const { fullStr, relStr } = formatDateTime(log.downloaded_at);
                const isUnameEmirgan = log.username?.toLowerCase() === 'emirgan';
                const initial = (log.username || "?").substring(0, 2).toUpperCase();

                return (
                  <div 
                    key={log.id}
                    className="p-3 sm:p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/50 hover:border-slate-700 transition-all flex items-center justify-between gap-3 shadow-xs"
                  >
                    {/* Left: Avatar + Username + Name + No (#ID) */}
                    <div className="flex items-center gap-3 min-w-0">
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

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-200 truncate">
                            {log.name ? log.name : `@${log.username}`}
                          </span>
                          {log.name && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              @{log.username}
                            </span>
                          )}
                          {/* Kullanıcı No */}
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-900 border border-slate-700 text-sky-400">
                            No: #{log.user_id !== null ? log.user_id : '?'}
                          </span>
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

                    {/* Right: Exact Timestamp */}
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1 justify-end">
                        <Clock size={12} className="text-sky-400" />
                        <span>{fullStr}</span>
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
            </div>
          )}

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

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Yalnızca Emirgan yöneticisi tarafından görüntülenebilir</span>
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
