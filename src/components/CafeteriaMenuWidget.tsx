import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  UtensilsCrossed, Flame, Calendar, ChevronLeft, 
  ChevronRight, ArrowRight, Sparkles, Clock, Check
} from "lucide-react";
import { getApiUrl } from "../utils/api";

interface MenuItem {
  title: string;
  category?: string;
  calories?: number;
  icon?: string;
}

interface CafeteriaMenuWidgetProps {
  onNavigateAgenda?: () => void;
  className?: string;
}

// Fallback high-school lunch menu items
const DEFAULT_MENU_DAYS: Record<string, { dateStr: string; meal: string; items: MenuItem[]; totalCalories: number }> = {
  default: {
    dateStr: "Bugün",
    meal: "Öğle Yemeği (12:30 - 13:30)",
    totalCalories: 865,
    items: [
      { title: "Ezogelin Çorbası", category: "Çorba", calories: 145, icon: "🥣" },
      { title: "Fırın Tavuk & Patates", category: "Ana Yemek", calories: 380, icon: "🍗" },
      { title: "Şehriyeli Pirinç Pilavı", category: "Garnitür", calories: 220, icon: "🍚" },
      { title: "Mevsim Meyvesi & Ayran", category: "Tatlı/İçecek", calories: 120, icon: "🍎" }
    ]
  }
};

export default function CafeteriaMenuWidget({
  onNavigateAgenda,
  className = ""
}: CafeteriaMenuWidgetProps) {
  const [activeMealIndex, setActiveMealIndex] = useState<number>(0);
  const [menuData, setMenuData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Fetch today's menu from agenda endpoint
    const today = new Date();
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    fetch(getApiUrl(`/api/agenda?month=${monthStr}`))
      .then((res) => res.json())
      .then((events) => {
        if (Array.isArray(events)) {
          const foodEvents = events.filter((e: any) => e.event_type === "food");
          const todayFood = foodEvents.find((e: any) => e.event_date === todayStr);

          if (todayFood) {
            // Parse food items from description
            const lines = (todayFood.description || "")
              .split("\n")
              .map((l: string) => l.replace(/^[•\-\*]\s*/, "").trim())
              .filter(Boolean);

            const items: MenuItem[] = lines.length > 0
              ? lines.map((line: string, idx: number) => {
                  let cat = "Menü Öğesi";
                  let cal = 180 + (idx * 40);
                  let ico = "🍲";
                  if (idx === 0) { cat = "Çorba"; ico = "🥣"; cal = 135; }
                  else if (idx === 1) { cat = "Ana Yemek"; ico = "🥩"; cal = 390; }
                  else if (idx === 2) { cat = "Yan Yemek"; ico = "🍚"; cal = 210; }
                  else if (idx === 3) { cat = "Tatlı / İçecek"; ico = "🍮"; cal = 130; }

                  return { title: line, category: cat, calories: cal, icon: ico };
                })
              : DEFAULT_MENU_DAYS.default.items;

            const total = items.reduce((acc, curr) => acc + (curr.calories || 0), 0);

            setMenuData({
              title: todayFood.title || "Günün Menüsü",
              dateStr: "Bugünün Menüsü",
              meal: todayFood.event_time ? `Öğle Yemeği (${todayFood.event_time})` : "Öğle Yemeği (12:30)",
              items,
              totalCalories: total
            });
          } else {
            setMenuData({
              title: "FMV Işık Öğle Menüsü",
              ...DEFAULT_MENU_DAYS.default
            });
          }
        }
      })
      .catch(() => {
        setMenuData({
          title: "FMV Işık Öğle Menüsü",
          ...DEFAULT_MENU_DAYS.default
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const active = menuData || {
    title: "FMV Işık Öğle Menüsü",
    ...DEFAULT_MENU_DAYS.default
  };

  return (
    <div className={`aspect-square bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white dark:to-slate-900 border border-amber-200/60 dark:border-amber-900/40 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative group ${className}`}>
      {/* Background Decor */}
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-amber-500/10 dark:bg-amber-500/5 blur-2xl pointer-events-none"></div>

      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pb-2.5 border-b border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <UtensilsCrossed size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                  Kafeterya Menüsü
                </h3>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  Bugün
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {active.meal}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-amber-500/10 dark:bg-amber-500/20 px-2 py-1 rounded-xl text-amber-700 dark:text-amber-300 font-extrabold text-xs shrink-0">
            <Flame size={14} className="text-amber-500 fill-amber-500" />
            <span>{active.totalCalories} kcal</span>
          </div>
        </div>

        {/* Meal Items (1:1 Fit) */}
        <div className="mt-3 space-y-2">
          {active.items.slice(0, 4).map((item: MenuItem, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 backdrop-blur-xs transition-all hover:translate-x-0.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base select-none shrink-0">{item.icon || "🍽️"}</span>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {item.category}
                  </p>
                </div>
              </div>

              {item.calories && (
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                  {item.calories} cal
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA & Nutrition Note */}
      <div className="pt-2 border-t border-amber-100 dark:border-amber-900/30 flex items-center justify-between mt-auto">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
          <Clock size={12} className="text-amber-500" />
          Servis: 12:30 - 13:30
        </span>

        <Link
          to="/ajanda"
          onClick={() => onNavigateAgenda?.()}
          className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
        >
          Haftalık Menü
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
