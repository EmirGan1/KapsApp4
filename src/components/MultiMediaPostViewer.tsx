import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, Download, Film, Image as ImageIcon, Eye, Layers, Volume2, VolumeX } from "lucide-react";
import { Post } from "../types";

export interface PostMediaItem {
  url: string;
  type: "image" | "video" | "file";
  name?: string;
  size?: number;
}

export function extractPostMediaItems(post: Post): PostMediaItem[] {
  const items: PostMediaItem[] = [];

  // 1. Try parsing attachments
  let attachmentsList: any[] = [];
  if (post.attachments) {
    if (typeof post.attachments === "string") {
      try {
        attachmentsList = JSON.parse(post.attachments);
      } catch {
        attachmentsList = [];
      }
    } else if (Array.isArray(post.attachments)) {
      attachmentsList = post.attachments;
    }
  }

  if (Array.isArray(attachmentsList) && attachmentsList.length > 0) {
    for (const att of attachmentsList) {
      if (!att) continue;
      if (typeof att === "string") {
        const ext = att.split(".").pop()?.toLowerCase() || "";
        const isVid = ["mp4", "webm", "mov", "mkv", "avi", "m4v", "3gp", "wmv", "flv", "ts"].includes(ext);
        const isDoc = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "txt", "rar"].includes(ext);
        items.push({
          url: att,
          type: isVid ? "video" : isDoc ? "file" : "image",
          name: att.split("/").pop() || "Dosya"
        });
      } else if (typeof att === "object" && att.url) {
        const ext = String(att.url).split(".").pop()?.toLowerCase() || "";
        const isVid = att.media_type === "video" || ["mp4", "webm", "mov", "mkv", "avi", "m4v", "3gp", "wmv", "flv", "ts"].includes(ext);
        const isDoc = att.media_type === "file" || ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "txt", "rar"].includes(ext);
        items.push({
          url: att.url,
          type: isVid ? "video" : isDoc ? "file" : (att.media_type || "image"),
          name: att.original_name || att.name || String(att.url).split("/").pop() || "Dosya",
          size: att.size
        });
      }
    }
  }

  // 2. If no attachments were found or only post.image is set
  if (items.length === 0 && post.image) {
    const ext = post.image.split(".").pop()?.toLowerCase() || "";
    const isVid = post.media_type === "video" || ["mp4", "webm", "mov", "mkv", "avi", "m4v", "3gp", "wmv", "flv", "ts"].includes(ext);
    const isDoc = post.media_type === "file" || ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "txt", "rar"].includes(ext);
    items.push({
      url: post.image,
      type: isVid ? "video" : isDoc ? "file" : (post.media_type || "image"),
      name: post.image.split("/").pop() || "Medya"
    });
  }

  return items;
}

interface MultiMediaPostViewerProps {
  post: Post;
  onOpenModal: (post: Post, initialIndex?: number) => void;
}

export default function MultiMediaPostViewer({ post, onOpenModal }: MultiMediaPostViewerProps) {
  const items = extractPostMediaItems(post);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];

  const handlePrev = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  // Touch Swipe Handlers for Instagram-like sliding
  const minSwipeDistance = 45;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX || !touchEndX) {
      setIsSwiping(false);
      return;
    }
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && items.length > 1) {
      handleNext(e);
    } else if (isRightSwipe && items.length > 1) {
      handlePrev(e);
    }
    setIsSwiping(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Render file attachment card
  const renderFileCard = (item: PostMediaItem) => {
    return (
      <div 
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-blue-400 transition-all cursor-pointer"
        onClick={() => onOpenModal(post, currentIndex)}
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
            <FileText size={24} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
              {item.name || "Ders Dosyası"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formatFileSize(item.size) || "Döküman"} • İndir veya Görüntüle
            </p>
          </div>
        </div>
        <a
          href={item.url}
          download={item.name || `kapsapp-file-${Date.now()}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Download size={14} />
          <span className="hidden sm:inline">İndir</span>
        </a>
      </div>
    );
  };

  // SINGLE ITEM VIEW
  if (items.length === 1) {
    if (currentItem.type === "file") {
      return <div className="px-2 sm:px-4 pb-3">{renderFileCard(currentItem)}</div>;
    }
    return (
      <div className="px-2 sm:px-4 pb-3">
        <div
          onClick={() => onOpenModal(post, 0)}
          className="relative w-full h-[320px] sm:h-[400px] max-h-[420px] bg-neutral-950/95 dark:bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-800/80 shadow-inner group/media select-none cursor-pointer"
        >
          {/* Ambient Backdrop */}
          {currentItem.type === "video" ? (
            <video
              src={currentItem.url}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-125 pointer-events-none"
            />
          ) : (
            <img
              src={currentItem.url}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none"
            />
          )}

          {/* Foreground Media */}
          {currentItem.type === "video" ? (
            <div className="relative z-10 w-full h-full flex items-center justify-center p-1">
              <video
                src={currentItem.url}
                autoPlay
                muted
                loop
                playsInline
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-xl shadow-lg pointer-events-none"
              />
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-xs flex items-center gap-1.5">
                <Film size={13} className="text-cyan-400" />
                <span>Video</span>
              </div>
            </div>
          ) : (
            <div className="relative z-10 w-full h-full flex items-center justify-center p-1">
              <img
                src={currentItem.url}
                alt={post.caption || "Gönderi"}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-xl shadow-lg transition-transform duration-300 group-hover/media:scale-[1.01]"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // MULTIPLE ITEMS CAROUSEL VIEW (Instagram-style Swipeable Slider)
  return (
    <div className="px-2 sm:px-4 pb-3 select-none">
      <div 
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative group/carousel rounded-2xl overflow-hidden shadow-sm bg-neutral-950/95 dark:bg-black border border-neutral-800/80 cursor-pointer touch-pan-y"
      >
        {/* Sliding Media Track with Smooth Instagram Animation */}
        <div 
          className="relative w-full h-[320px] sm:h-[400px] max-h-[420px] flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {items.map((item, idx) => (
            <div
              key={`${item.url}_${idx}`}
              onClick={() => onOpenModal(post, idx)}
              className="w-full h-full shrink-0 relative flex items-center justify-center overflow-hidden"
            >
              {item.type === "file" ? (
                <div className="p-4 w-full flex items-center justify-center">
                  {renderFileCard(item)}
                </div>
              ) : item.type === "video" ? (
                <>
                  {/* Video Ambient Backdrop */}
                  <video
                    src={item.url}
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-125 pointer-events-none"
                  />
                  {/* Foreground Video */}
                  <div className="relative z-10 w-full h-full flex items-center justify-center p-1">
                    <video
                      src={item.url}
                      autoPlay={idx === currentIndex}
                      muted
                      loop
                      playsInline
                      className="max-h-full max-w-full w-auto h-auto object-contain rounded-xl shadow-lg pointer-events-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Photo Ambient Backdrop */}
                  <img
                    src={item.url}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none"
                  />
                  {/* Foreground Image */}
                  <div className="relative z-10 w-full h-full flex items-center justify-center p-1">
                    <img
                      src={item.url}
                      alt={post.caption || item.name || "Fotoğraf"}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="max-h-full max-w-full w-auto h-auto object-contain rounded-xl shadow-lg"
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Counter Badge (Top Right, Instagram style) */}
        <div className="absolute top-3 right-3 z-20 bg-black/75 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md pointer-events-none border border-white/10">
          <Layers size={13} className="text-blue-400" />
          <span>{currentIndex + 1} / {items.length}</span>
        </div>

        {/* Video / Type Indicator (Top Left) */}
        {currentItem.type === "video" && (
          <div className="absolute top-3 left-3 z-20 bg-black/75 backdrop-blur-md text-cyan-300 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md pointer-events-none border border-white/10">
            <Film size={13} />
            <span>Video</span>
          </div>
        )}

        {/* Instagram-Style Center Pagination Dots (Overlaid at bottom of media) */}
        {items.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`transition-all duration-200 rounded-full cursor-pointer ${
                  idx === currentIndex
                    ? "w-2.5 h-2.5 bg-white shadow-sm scale-110"
                    : "w-1.5 h-1.5 bg-white/40 hover:bg-white/75"
                }`}
                title={`${idx + 1}. medya`}
              />
            ))}
          </div>
        )}

        {/* Navigation Arrows (Easily accessible on desktop and mobile) */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/65 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer border border-white/20"
              title="Önceki (Sol)"
            >
              <ChevronLeft size={22} />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/65 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer border border-white/20"
              title="Sonraki (Sağ)"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail Strip below carousel for quick jumping */}
      <div className="mt-2 flex items-center justify-between gap-2 overflow-hidden px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full scrollbar-none">
          {items.map((it, idx) => (
            <button
              key={`${it.url}_${idx}`}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                idx === currentIndex
                  ? "border-blue-500 scale-105 shadow-md ring-2 ring-blue-500/30"
                  : "border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
              }`}
            >
              {it.type === "video" ? (
                <div className="w-full h-full bg-neutral-900 flex items-center justify-center relative">
                  <video src={it.url} muted className="w-full h-full object-cover pointer-events-none" />
                  <Film size={14} className="absolute text-white drop-shadow-md" />
                </div>
              ) : it.type === "file" ? (
                <div className="w-full h-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <FileText size={16} />
                </div>
              ) : (
                <img
                  src={it.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              )}
              <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[9px] text-white px-1 rounded font-mono">
                {idx + 1}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
