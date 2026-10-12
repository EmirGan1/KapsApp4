import React from 'react';
import { 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  FileSpreadsheet, 
  FileArchive, 
  Presentation, 
  FileCode, 
  File as FileIcon,
  Tag,
  Sparkles,
  Calendar,
  HardDrive
} from 'lucide-react';
import { CourseFileItem } from './CourseFilesManager';
import { getApiUrl } from '../utils/api';

/**
 * Güvenli ve dayanıklı konu (topic) ayrıştırıcı
 * Ham JSON stringleri (örn: '["Number and Algebra"]'), virgülle ayrılmış dizgileri
 * veya dizi yapılarını temiz bir string dizisine dönüştürür.
 */
export const parseTopics = (topicsData: any, fallbackTag?: string | null): string[] => {
  if (!topicsData && !fallbackTag) return [];

  const sanitizeStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // Tırnak işaretlerini temizle
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      str = str.slice(1, -1).trim();
    }
    // Ters eğik çizgi kaçışlarını temizle
    str = str.replace(/\\"/g, '"');
    return str.trim();
  };

  const extract = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.flatMap(item => extract(item));
    }
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (!trimmed) return [];

      // JSON Array veya Object biçimindeyse
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.flatMap(item => extract(item));
          }
          if (typeof parsed === 'string') {
            return extract(parsed);
          }
        } catch {
          // JSON parse hatasında köşeli ayraç ve tırnakları sıyır
          const stripped = trimmed.replace(/^[\[{\("']+|[\]}\)"']+$/g, '');
          if (stripped.includes(',')) {
            return stripped.split(',').flatMap(s => extract(s));
          }
          return [sanitizeStr(stripped)];
        }
      }

      // Virgülle ayrılmış string ise
      if (trimmed.includes(',')) {
        return trimmed.split(',').flatMap(s => extract(s));
      }

      return [sanitizeStr(trimmed)];
    }
    return [sanitizeStr(data)];
  };

  let rawList: string[] = [];
  if (topicsData) {
    rawList = extract(topicsData);
  }
  if (rawList.length === 0 && fallbackTag) {
    rawList = extract(fallbackTag);
  }

  // Boş, 'null', 'undefined', '[]' gibi sahte değerleri filtrele ve tekilleştir
  const cleaned = rawList
    .map(s => sanitizeStr(s))
    .filter(s => s.length > 0 && s !== 'null' && s !== 'undefined' && s !== '[]' && s !== '{}');

  return Array.from(new Set(cleaned));
};

export interface CourseMaterialCardProps {
  file: CourseFileItem;
  currentUserId: number;
  isEmirgan: boolean;
  onPreviewPdf: (url: string, title: string) => void;
  onInitiateDelete: (file: CourseFileItem) => void;
  layoutMode?: 'grid' | 'list';
}

export const CourseMaterialCard: React.FC<CourseMaterialCardProps> = ({
  file,
  currentUserId,
  isEmirgan,
  onPreviewPdf,
  onInitiateDelete,
  layoutMode = 'grid'
}) => {
  const isOwner = Number(file.uploaded_by) === Number(currentUserId);
  const canDelete = isOwner || isEmirgan;

  const rawFilename = file.original_name || file.filename || 'Adsız Dosya';
  const fileExt = rawFilename.split('.').pop()?.toUpperCase() || 'DOSYA';
  const isPdf = (file.mimetype || '').includes('pdf') || fileExt.toLowerCase() === 'pdf';

  // Konuları güvenli şekilde parse et
  const parsedTopics = parseTopics(file.topics, file.topic_tag);
  const isAllTopics = parsedTopics.includes('ALL') || 
                      parsedTopics.includes('Hepsi') || 
                      file.topic_tag === 'ALL' || 
                      file.topic_tag === 'Hepsi';
  const regularTopics = parsedTopics.filter(t => t !== 'ALL' && t !== 'Hepsi');

  // Boyut biçimlendirici
  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Tarih biçimlendirici
  const formatUploadDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return `Bugün, ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  // Dosya ikonu ve renk teması
  const getFileStyling = () => {
    const ext = fileExt.toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (mime.includes('pdf') || ext === 'pdf') {
      return {
        icon: <FileText className="w-5 h-5 text-rose-500 shrink-0" />,
        badgeBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
        cardBorder: 'hover:border-rose-300 dark:hover:border-rose-800'
      };
    }
    if (mime.includes('word') || ['doc', 'docx'].includes(ext)) {
      return {
        icon: <FileText className="w-5 h-5 text-blue-500 shrink-0" />,
        badgeBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
        cardBorder: 'hover:border-blue-300 dark:hover:border-blue-800'
      };
    }
    if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx'].includes(ext)) {
      return {
        icon: <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />,
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
        cardBorder: 'hover:border-emerald-300 dark:hover:border-emerald-800'
      };
    }
    if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
      return {
        icon: <Presentation className="w-5 h-5 text-amber-500 shrink-0" />,
        badgeBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
        cardBorder: 'hover:border-amber-300 dark:hover:border-amber-800'
      };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return {
        icon: <FileArchive className="w-5 h-5 text-purple-500 shrink-0" />,
        badgeBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/50',
        cardBorder: 'hover:border-purple-300 dark:hover:border-purple-800'
      };
    }
    if (['py', 'js', 'ts', 'html', 'css', 'json', 'cpp', 'java'].includes(ext)) {
      return {
        icon: <FileCode className="w-5 h-5 text-cyan-500 shrink-0" />,
        badgeBg: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900/50',
        cardBorder: 'hover:border-cyan-300 dark:hover:border-cyan-800'
      };
    }
    return {
      icon: <FileIcon className="w-5 h-5 text-slate-500 shrink-0" />,
      badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      cardBorder: 'hover:border-slate-300 dark:hover:border-slate-700'
    };
  };

  const styleInfo = getFileStyling();
  const dateStr = formatUploadDate(file.created_at);
  const uploaderName = file.uploader_name || 'Öğrenci';

  return (
    <div
      className={`group relative bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 sm:p-4 transition-all duration-200 hover:shadow-md ${styleInfo.cardBorder} flex flex-col justify-between`}
    >
      {/* 1. ÜST KISIM: İkon, Format Rozeti ve Aksiyon Butonları */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            {styleInfo.icon}
          </div>
          <div className="min-w-0">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase border ${styleInfo.badgeBg}`}>
              {fileExt}
            </span>
          </div>
        </div>

        {/* Hızlı Aksiyon Butonları (Sağ Üstte Net ve Çakışmayan Alan) */}
        <div className="flex items-center gap-1 shrink-0">
          {isPdf && (
            <button
              type="button"
              onClick={() => onPreviewPdf(getApiUrl(file.url), rawFilename)}
              className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
              title="Önizle (PDF)"
              aria-label="Önizle"
            >
              <Eye size={16} />
            </button>
          )}

          <a
            href={getApiUrl(file.url)}
            download={rawFilename}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
            title="Dosyayı İndir"
            aria-label="İndir"
          >
            <Download size={16} />
          </a>

          {canDelete && (
            <button
              type="button"
              onClick={() => onInitiateDelete(file)}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Materyali Sil"
              aria-label="Sil"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 2. ORTA KISIM: Tam ve Okunaklı Dosya Başlığı (Taşmayan, 2 Satıra Saran Esnek Alan) */}
      <div className="flex-1 my-1">
        <h4 
          className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-snug break-words line-clamp-2 hover:line-clamp-none transition-all cursor-default"
          title={rawFilename}
        >
          {rawFilename}
        </h4>

        {/* 3. KONU (TOPIC) ETİKETLERİ: Asla Ham JSON string olarak basılmaz, estetik chipler halinde gösterilir */}
        <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
          {isAllTopics ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
              <Sparkles size={11} className="shrink-0 text-amber-500" />
              <span>🌟 Tüm Konular (Hepsi)</span>
            </span>
          ) : regularTopics.length > 0 ? (
            <>
              {regularTopics.slice(0, 3).map((topicName, idx) => (
                <span
                  key={`${topicName}_${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 max-w-[200px]"
                  title={topicName}
                >
                  <Tag size={10} className="shrink-0 text-indigo-500" />
                  <span className="truncate">{topicName}</span>
                </span>
              ))}
              {regularTopics.length > 3 && (
                <span 
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-help"
                  title={regularTopics.slice(3).join(', ')}
                >
                  +{regularTopics.length - 3} daha
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Tag size={10} className="shrink-0 text-slate-400" />
              <span>Genel Materyal</span>
            </span>
          )}
        </div>
      </div>

      {/* 4. ALT KISIM (METADATA BAR): Yükleyen Kişi, Dosya Boyutu ve Tarih — Asla üst üste binmez */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Uploader Avatar / Circle */}
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-2xs">
            {uploaderName.charAt(0).toUpperCase()}
          </div>
          <span 
            className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px] sm:max-w-[160px]"
            title={`Yükleyen: ${uploaderName}`}
          >
            {uploaderName}
          </span>
          <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
          <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
            <HardDrive size={10} className="text-slate-400 inline" />
            <span>{formatFileSize(file.size)}</span>
          </span>
        </div>

        {dateStr && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-1">
            <Calendar size={10} className="text-slate-400" />
            <span>{dateStr}</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default CourseMaterialCard;
