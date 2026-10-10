import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  LayoutGrid, Heart, MessageCircle, ArrowRight, 
  Sparkles, Image as ImageIcon, Flame
} from "lucide-react";
import Avatar from "./Avatar";
import { getApiUrl } from "../utils/api";

export interface MiniFeedPost {
  id: number;
  user_id?: number;
  username: string;
  avatar?: string;
  color?: string;
  caption: string;
  image?: string;
  likes_count?: number;
  comments_count?: number;
  created_at?: string;
  subject?: string;
}

interface CommunityMiniFeedWidgetProps {
  onNavigateFeed?: () => void;
  className?: string;
}

const FALLBACK_POSTS: MiniFeedPost[] = [
  {
    id: 1,
    username: "Deniz Yılmaz",
    color: "#3B82F6",
    caption: "IB Physics HL Paper 2 için çıkmış soru özetlerini ders notları klasörüne yükledim, inceleyebilirsiniz!",
    likes_count: 14,
    comments_count: 5,
    created_at: "25 dk önce",
    subject: "Physics"
  },
  {
    id: 2,
    username: "Zeynep Kaya",
    color: "#EC4899",
    caption: "Cumartesi etütleri öncesinde Matematik deneme analizini bitiren var mı? Birlikte bakalım.",
    likes_count: 9,
    comments_count: 3,
    created_at: "1 sa önce",
    subject: "Mathematics"
  },
  {
    id: 3,
    username: "Ali Demir",
    color: "#10B981",
    caption: "Kafeteryada öğle arasında 101 Okey veya Bilardo masası açıyoruz, katılmak isteyenler gelsin! 🎱",
    likes_count: 18,
    comments_count: 8,
    created_at: "2 sa önce",
    subject: "Sosyal"
  }
];

export default function CommunityMiniFeedWidget({
  onNavigateFeed,
  className = ""
}: CommunityMiniFeedWidgetProps) {
  const [posts, setPosts] = useState<MiniFeedPost[]>(FALLBACK_POSTS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
    fetch(getApiUrl("/api/feed?limit=3"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => {
        if (!res.ok) throw new Error("Feed network error");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: MiniFeedPost[] = data.slice(0, 3).map((p: any) => ({
            id: p.id,
            user_id: p.user_id,
            username: p.username || "Öğrenci",
            avatar: p.avatar,
            color: p.color,
            caption: p.caption || "Yeni bir gönderi paylaştı.",
            image: p.image,
            likes_count: p.likes_count || 0,
            comments_count: p.comments_count || 0,
            created_at: p.created_at ? new Date(p.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "Az önce",
            subject: p.subject
          }));
          setPosts(mapped);
        }
      })
      .catch(() => {
        // Fallback to rich pre-seeded posts
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between ${className}`}>
      <div>
        {/* Başlık ve Akışa Git Butonu */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <LayoutGrid size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Topluluk Akışı
                </h3>
                <span className="px-1.5 py-0.2 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-extrabold">
                  Yeni
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Son paylaşılan gönderiler</p>
            </div>
          </div>

          <Link
            to="/akis"
            onClick={() => onNavigateFeed?.()}
            className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>Akışa Git</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Gönderi Kartları (Son 2-3 Gönderi, Kompakt) */}
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto scrollbar-thin">
          {posts.slice(0, 3).map((post) => (
            <Link
              key={post.id}
              to="/akis"
              onClick={() => onNavigateFeed?.()}
              className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-2.5 hover:border-violet-300 dark:hover:border-violet-700 transition-all cursor-pointer group block"
            >
              <Avatar
                url={post.avatar}
                name={post.username}
                color={post.color}
                size={8}
                className="shrink-0 mt-0.5"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {post.username}
                    </span>
                    {post.subject && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                        {post.subject}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {post.created_at}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug">
                  {post.caption}
                </p>

                {/* Mikro Beğeni & Yorum Rozeti */}
                <div className="flex items-center gap-3 mt-1.5 pt-1 text-[11px] text-slate-400 border-t border-slate-100/60 dark:border-slate-800/60">
                  <span className="flex items-center gap-1 font-semibold text-rose-500/80">
                    <Heart size={11} className="fill-rose-500/30" />
                    <span>{post.likes_count || 0}</span>
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-slate-400">
                    <MessageCircle size={11} />
                    <span>{post.comments_count || 0}</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Alt Mikro Buton */}
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>Soru sor, ders notu paylaş</span>
        <Link
          to="/akis"
          onClick={() => onNavigateFeed?.()}
          className="font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
        >
          <span>Gönderi Paylaş +</span>
        </Link>
      </div>
    </div>
  );
}
