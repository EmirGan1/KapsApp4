import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, Award, Clock, Crown, Flame, Gamepad2, KeyRound, Laptop, LayoutGrid, Megaphone, RefreshCw, Sparkles, Terminal, UserCheck, Users } from "lucide-react";
import AdminServerStatus from "./AdminServerStatus";

const sections = {
  university: { label: "Üniversite belgeleri hazırlık", detail: "CV, sertifika ve başvuru arşivi", icon: Award },
  home: { label: "Ana menü", detail: "", icon: LayoutGrid },
  pending: { label: "Kayıt istekleri", detail: "", icon: UserCheck },
  resets: { label: "Şifre sıfırlama", detail: "", icon: KeyRound },
  users: { label: "Kullanıcılar", detail: "Hesaplar ve çevrim içi üyeler", icon: Users },
  roles: { label: "Roller", detail: "Yetkiler ve rol sıralaması", icon: Award },
  tables: { label: "Aktif masalar", detail: "Açık oyun masalarını yönet", icon: Gamepad2 },
  hardware: { label: "Donanım banları", detail: "Cihaz erişim kısıtlamaları", icon: Laptop },
  broadcast: { label: "Canlı duyuru", detail: "Kullanıcılara duyuru gönder", icon: Megaphone },
  scare: { label: "Kapscare ve pop-up", detail: "Efekt ve pop-up yönetimi", icon: Flame },
  logs: { label: "Sistem logları", detail: "Erişim kayıtları ve uygulama bilgileri", icon: Terminal },
  activity: { label: "Ekran süresi", detail: "Kullanıcı etkinliğini incele", icon: Clock },
  quote: { label: "Günün sözü", detail: "Yayımlanan sözü güncelle", icon: Sparkles },
} as const;

export type AdminTab = keyof typeof sections;
const tabs = Object.keys(sections) as AdminTab[];
const requestTabs = ["pending", "resets"] as const;
const actionTabs = tabs.filter(tab => tab !== "home" && tab !== "pending" && tab !== "resets");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300";

type Props = {
  universityAccess?: boolean;
  activeTab: AdminTab;
  onSelect: (tab: AdminTab) => void;
  registrations: number | null;
  resets: number | null;
  refreshKey: number;
  onRefresh: () => void;
  children: ReactNode;
};

export default function AdminPanelShell({ universityAccess = false, activeTab, onSelect, registrations, resets, refreshKey, onRefresh, children }: Props) {
  const visibleTabs = tabs.filter(tab => tab !== "university" || universityAccess);
  const visibleActions = actionTabs.filter(tab => tab !== "university" || universityAccess);
  const counts = { pending: registrations, resets };
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollArea.current?.scrollTo(0, 0);
  }, [activeTab]);

  return (
    <>
      <header className="shrink-0 border-b border-white/10 bg-[#10151e]">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal-300/25 bg-teal-300/10 text-teal-200">
              <Crown size={19} aria-hidden="true" />
            </span>
            <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">Emirgan Panel</h1>
          </div>
          <button type="button" aria-label="Panel verilerini yenile" onClick={onRefresh}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-slate-200 hover:bg-white/10 ${focus}`}>
            <RefreshCw size={15} aria-hidden="true" /> <span className="hidden sm:inline">Yenile</span>
          </button>
        </div>
      </header>

      <div ref={scrollArea} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-[#0b1018]">
        <div className="mx-auto grid max-w-[1680px] items-start gap-3 px-3 pb-5 sm:px-6 lg:grid-cols-[165px_minmax(0,1fr)_200px] lg:gap-4 lg:pt-4 xl:grid-cols-[195px_minmax(0,1fr)_235px]">
          <div className="sticky top-0 z-20 space-y-2 bg-[#0b1018] py-2 lg:contents lg:space-y-0">
            <nav aria-label="Emirgan panel menüsü" className="rounded-2xl border border-white/10 bg-[#121823] p-2 lg:sticky lg:top-4 lg:col-start-1 lg:row-start-1 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 lg:hidden">
                <select aria-label="Panel bölümü" value={activeTab} onChange={event => onSelect(event.target.value as AdminTab)}
                  className={`min-h-11 min-w-0 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs text-white ${focus}`}>
                  {visibleTabs.map(tab => <option key={tab} value={tab}>{sections[tab].label}</option>)}
                </select>
                {requestTabs.map(tab => (
                  <button type="button" key={tab} onClick={() => onSelect(tab)}
                    aria-current={activeTab === tab ? "page" : undefined}
                    aria-label={`${sections[tab].label}: ${counts[tab] ?? "güncel sayı alınamadı"}`}
                    className={`flex min-h-11 items-center gap-1 rounded-lg border border-white/10 px-2 text-[11px] text-teal-200 hover:bg-white/10 ${focus}`}>
                    {tab === "pending" ? "Kayıt" : "Şifre"} <strong className="tabular-nums">{counts[tab] ?? "—"}</strong>
                  </button>
                ))}
              </div>
              <div className="hidden space-y-0.5 lg:block">
                {visibleTabs.map(tab => {
                  const { label, icon: Icon } = sections[tab];
                  return (
                    <button type="button" key={tab} onClick={() => onSelect(tab)}
                      aria-current={tab === activeTab ? "page" : undefined}
                      className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs xl:text-sm ${focus} ${tab === activeTab ? "bg-teal-300/10 font-semibold text-teal-200" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
                      <Icon size={15} className="shrink-0" aria-hidden="true" />
                      <span className="flex-1 leading-tight">{label}</span>
                      {(tab === "pending" || tab === "resets") &&
                        <span className={`tabular-nums ${counts[tab] ? "font-semibold text-teal-200" : "text-slate-400"}`}>{counts[tab] ?? "—"}</span>}
                    </button>
                  );
                })}
              </div>
            </nav>
            <div className="lg:sticky lg:top-4 lg:col-start-3 lg:row-start-1">
              <AdminServerStatus refreshKey={refreshKey} />
            </div>
          </div>

          <section aria-label={sections[activeTab].label} className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-1">
            {activeTab === "home" && (
              <>
                <div className="rounded-2xl border border-teal-200/15 bg-gradient-to-br from-[#162c31] via-[#14212c] to-[#121823] p-4 sm:p-5">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">Ana menü</h2>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                    {requestTabs.map(tab => {
                      const { label, icon: Icon } = sections[tab];
                      return (
                        <button type="button" key={tab} onClick={() => onSelect(tab)}
                          className={`min-w-0 rounded-xl border border-white/10 bg-black/15 p-3 text-left hover:border-teal-200/40 ${focus}`}>
                          <span className="flex items-center justify-between gap-1 text-teal-200">
                            <Icon size={17} aria-hidden="true" /><ArrowUpRight size={15} aria-hidden="true" />
                          </span>
                          <span className="mt-2 block text-2xl font-semibold tabular-nums text-white">{counts[tab] ?? "—"}</span>
                          <span className="text-xs text-slate-300 sm:text-sm">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 2xl:grid-cols-3">
                  {visibleActions.map(tab => {
                    const { label, detail, icon: Icon } = sections[tab];
                    return (
                      <button type="button" key={tab} onClick={() => onSelect(tab)}
                        className={`group min-w-0 rounded-xl border border-white/10 bg-[#121823] p-3 text-left transition-colors hover:border-teal-200/30 hover:bg-[#172431] ${focus}`}>
                        <span className="mb-2 flex items-center justify-between text-teal-200">
                          <Icon size={17} aria-hidden="true" /><ArrowUpRight size={14} className="text-slate-400 group-hover:text-teal-200" aria-hidden="true" />
                        </span>
                        <span className="block text-sm font-semibold text-white">{label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-400">{detail}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {children}
          </section>
        </div>
      </div>
    </>
  );
}
