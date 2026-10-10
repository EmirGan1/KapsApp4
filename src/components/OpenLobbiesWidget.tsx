import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Link } from "react-router-dom";
import { 
  Gamepad2, Users, Play, Plus, RefreshCw, Trophy, 
  Sparkles, Lock, ArrowRight, ShieldAlert, CircleDot
} from "lucide-react";
import { getApiUrl } from "../utils/api";

export interface UnifiedGameTable {
  id: string | number;
  gameType: "billiards" | "batak" | "okey" | "okey101" | "uno" | "blackjack" | "drawguess" | "party" | string;
  title: string;
  hostId: number;
  hostName: string;
  hostAvatar?: string | null;
  playerCount: number;
  maxPlayers: number;
  botCount?: number;
  status: "Lobi Bekliyor" | "Oyunda" | string;
  minBet?: number;
  isPrivate?: boolean;
  gameMode?: string;
  targetScore?: number;
}

interface OpenLobbiesWidgetProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername: string;
  onNavigateGames?: (gameTab?: string) => void;
  className?: string;
}

export default function OpenLobbiesWidget({
  socket,
  currentUserId,
  currentUsername,
  onNavigateGames,
  className = ""
}: OpenLobbiesWidgetProps) {
  const [tables, setTables] = useState<UnifiedGameTable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchTables = () => {
    setIsLoading(true);
    fetch(getApiUrl("/api/active-tables"))
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.tables)) {
          setTables(data.tables);
        }
      })
      .catch((err) => {
        console.error("Open lobbies fetch error:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchTables();

    if (!socket) return;

    const handleTablesUpdate = (updatedList: any[]) => {
      if (Array.isArray(updatedList)) {
        setTables(updatedList);
        setIsLoading(false);
      }
    };

    socket.on("active_tables_updated", handleTablesUpdate);
    socket.emit("get_active_tables", handleTablesUpdate);

    // Periodic refresh fallback
    const interval = setInterval(fetchTables, 15000);

    return () => {
      socket.off("active_tables_updated", handleTablesUpdate);
      clearInterval(interval);
    };
  }, [socket]);

  // Filter open lobbies (waiting for players or all active)
  const filteredTables = tables.filter((t) => {
    if (filterType === "all") return true;
    return t.gameType === filterType;
  });

  const getGameBadge = (type: string) => {
    switch (type) {
      case "billiards":
        return { label: "KapsPool 🎱", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
      case "okey101":
        return { label: "101 Okey 🀄", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" };
      case "okey":
        return { label: "Klasik Okey 🀄", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" };
      case "batak":
        return { label: "Batak ♠️", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" };
      case "uno":
        return { label: "UNO 🃏", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" };
      case "blackjack":
        return { label: "Blackjack 🎰", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" };
      case "drawguess":
        return { label: "Çiz Bakalım 🎨", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30" };
      case "party":
        return { label: "Party Modu 🎉", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" };
      default:
        return { label: "Oyun Odası 🎮", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30" };
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${className}`}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Gamepad2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  Canlı Oyun Lobileri
                </h3>
                {tables.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {tables.length} Masa Açık
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                101 Okey, Bilardo, Batak ve Party modunda oyuncu bekleyen masalar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchTables}
              title="Yenile"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin text-emerald-500" : ""} />
            </button>
            <Link
              to="/oyunlar"
              onClick={() => onNavigateGames?.()}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
            >
              Tümünü Gör
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 py-3 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "Tümü" },
            { id: "billiards", label: "Bilardo 🎱" },
            { id: "okey101", label: "101 Okey 🀄" },
            { id: "okey", label: "Klasik Okey" },
            { id: "uno", label: "UNO 🃏" },
            { id: "blackjack", label: "Blackjack 🎰" }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === cat.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tables List */}
        <div className="space-y-2.5 mt-1 max-h-72 overflow-y-auto pr-1">
          {isLoading && tables.length === 0 ? (
            <div className="py-10 text-center">
              <RefreshCw size={24} className="mx-auto text-emerald-500 animate-spin mb-2" />
              <p className="text-xs text-slate-500">Açık masalar taranıyor...</p>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="py-8 px-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Gamepad2 size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Şu an açık masa bulunmuyor
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                İlk masayı sen kur, arkadaşlarını davet et veya oyun lobisine geç!
              </p>
              <Link
                to="/oyunlar"
                onClick={() => onNavigateGames?.()}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
              >
                <Plus size={14} />
                Masa Kur
              </Link>
            </div>
          ) : (
            filteredTables.map((table) => {
              const badge = getGameBadge(table.gameType);
              const isWaiting = table.status === "Lobi Bekliyor" || table.playerCount < table.maxPlayers;

              return (
                <div
                  key={`${table.gameType}-${table.id}`}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-800/60 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {table.hostAvatar ? (
                        <img
                          src={table.hostAvatar.startsWith("http") || table.hostAvatar.startsWith("/uploads/") ? table.hostAvatar : `/uploads/${table.hostAvatar}`}
                          alt={table.hostName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                          onError={(e) => {
                            (e.target as any).src = "https://www.gravatar.com/avatar?d=mp";
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
                          {String(table.hostName || "O").substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      {table.isPrivate && (
                        <span className="absolute -top-1 -right-1 p-0.5 bg-slate-900 text-amber-400 rounded-full border border-slate-700">
                          <Lock size={10} />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {table.title || `Masa #${table.id}`}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="truncate">Kurucu: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{table.hostName}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Users size={12} className="text-emerald-500" />
                          {table.playerCount}/{table.maxPlayers}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${
                      isWaiting 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}>
                      {table.status || (isWaiting ? "Bekliyor" : "Oyunda")}
                    </span>

                    <Link
                      to="/oyunlar"
                      onClick={() => onNavigateGames?.()}
                      className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/30 flex items-center gap-1 text-xs font-bold"
                    >
                      <Play size={13} />
                      <span className="hidden sm:inline">Katıl</span>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Turnuva & ödüllü maçlar için KapsPool salonuna katıl.
        </span>
        <Link
          to="/oyunlar"
          onClick={() => onNavigateGames?.()}
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
        >
          Oyun Masaları →
        </Link>
      </div>
    </div>
  );
}
