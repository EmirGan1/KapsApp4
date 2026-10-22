import React, { useState } from 'react';
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
  HardDrive,
  CheckCircle2,
  Target,
  BookOpen,
  User,
  Info
} from 'lucide-react';
import { CourseFileItem } from './CourseFilesManager';
import { getApiUrl } from '../utils/api';

export type DocumentType = 'question_paper' | 'mark_scheme' | 'notes' | 'summary' | 'other';

/**
 * Güvenli ve dayanıklı konu (topic) ayrıştırıcı
 * Ham JSON stringleri (örn: '["Number and Algebra"]'), virgülle ayrılmış dizgileri
 * veya dizi yapılarını temiz bir string dizisine dönüştürür.
 * Tırnak işareti, köşeli parantez veya kaçış karakterlerini kesin olarak temizler.
 */
export const formatTopics = (rawTopics: any, fallbackTag?: string | null): string[] => {
  if (!rawTopics && !fallbackTag) return [];

  const cleanItem = (item: any): string => {
    if (item === null || item === undefined) return '';
    let str = String(item).trim();
    // Tırnak ve köşeli parantezleri temizle
    str = str.replace(/^[\[{\("']+|[\]}\)"']+$/g, '').trim();
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      str = str.slice(1, -1).trim();
    }
    str = str.replace(/\\"/g, '"').replace(/[\[\]"']/g, '').trim();
    return str;
  };

  const extract = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.flatMap(item => extract(item));
    }
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (!trimmed) return [];

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
          return trimmed.replace(/[\[\]"']/g, '').split(',').map(s => cleanItem(s)).filter(Boolean);
        }
      }

      if (trimmed.includes(',')) {
        return trimmed.split(',').map(s => cleanItem(s)).filter(Boolean);
      }

      const cleaned = cleanItem(trimmed);
      return cleaned ? [cleaned] : [];
    }
    const cleaned = cleanItem(data);
    return cleaned ? [cleaned] : [];
  };

  let list: string[] = [];
  if (rawTopics) list = extract(rawTopics);
  if (list.length === 0 && fallbackTag) list = extract(fallbackTag);

  const finalTopics = list
    .map(cleanItem)
    .filter(s => s.length > 0 && s !== 'null' && s !== 'undefined' && s !== '[]' && s !== '{}');

  return Array.from(new Set(finalTopics));
};

export const parseTopics = formatTopics;

export const canDeleteFile = (file: any, currentUser: any): boolean => {
  if (!currentUser) return false;
  if (typeof currentUser === 'number') {
    return Number(file?.uploaded_by || file?.userId) === currentUser;
  }
  const username = String(currentUser.username || currentUser.name || '').trim().toLowerCase();
  const isSuperAdmin = 
    username === 'emirgan' || 
    currentUser.role === 'ROOT' || 
    currentUser.role === 'ADMIN' || 
    currentUser.role === 'admin' ||
    currentUser.is_admin === 1 ||
    currentUser.is_admin === true ||
    currentUser.isEmirgan === true;

  const fileUploaderId = Number(file?.uploaded_by || file?.userId);
  const currentId = Number(currentUser.id);

  const isOwner = 
    (fileUploaderId > 0 && currentId > 0 && fileUploaderId === currentId) || 
    (file?.uploaderUsername && file.uploaderUsername.toLowerCase() === username) ||
    (file?.uploader_name && file.uploader_name.replace(/^@/, '').toLowerCase() === username);

  return isSuperAdmin || isOwner;
};

export interface CourseMaterialCardProps {
  file: CourseFileItem;
  currentUserId: number;
  isEmirgan: boolean;
  onPreviewPdf: (url: string, title: string) => void;
  onInitiateDelete: (file: CourseFileItem) => void;
  onViewDownloadHistory?: (file: CourseFileItem) => void;
  layoutMode?: 'grid' | 'list';
}

export const CourseMaterialCard: React.FC<CourseMaterialCardProps> = ({
  file,
  currentUserId,
  isEmirgan,
  onPreviewPdf,
  onInitiateDelete,
  onViewDownloadHistory,
  layoutMode = 'list'
}) => {
  const [showAllTopicsTooltip, setShowAllTopicsTooltip] = useState(false);

  // Check if current user is authorized to view download counts and audit logs (emirgan / ROOT / ADMIN)
  const isAuthorizedAdmin = isEmirgan || 
    (typeof localStorage !== 'undefined' && (
      (localStorage.getItem("lan_account_role") || "").toUpperCase() === "ROOT" ||
      (localStorage.getItem("lan_account_role") || "").toUpperCase() === "ADMIN" ||
      (localStorage.getItem("lan_username") || "").toLowerCase() === "emirgan"
    ));
  const canViewDownloads = Boolean(isAuthorizedAdmin || file.download_count !== undefined);

  const canDelete = canDeleteFile(file, { id: currentUserId, isEmirgan, username: isEmirgan ? 'emirgan' : '' });

  const rawFilename = file.original_name || file.filename || 'Adsız Dosya';
  const fileExt = rawFilename.split('.').pop()?.toUpperCase() || 'DOSYA';
  const isPdf = (file.mimetype || '').includes('pdf') || fileExt.toLowerCase() === 'pdf';

  // Belge türünü tespit et (doc_type, docType veya dosya adına göre)
  const lowerName = rawFilename.toLowerCase();
  const explicitDocTypeStr = String(file.docType || file.doc_type || '');

  const isBothType = explicitDocTypeStr === 'both' || 
                     (explicitDocTypeStr.includes('question_paper') && explicitDocTypeStr.includes('mark_scheme'));

  const isMarkScheme = isBothType || (
    explicitDocTypeStr && explicitDocTypeStr !== 'other'
      ? (explicitDocTypeStr === 'mark_scheme')
      : (lowerName.includes('markscheme') || lowerName.includes('_ms') || lowerName.includes('ms.') || lowerName.includes('cevap') || lowerName.includes('cozum') || lowerName.includes('çözüm'))
  );

  const isQuestionPaper = isBothType || (
    explicitDocTypeStr && explicitDocTypeStr !== 'other'
      ? (explicitDocTypeStr === 'question_paper')
      : (lowerName.includes('paper') || lowerName.includes('exam') || lowerName.includes('deneme') || lowerName.includes('soru'))
  );

  const isNotes = (
    explicitDocTypeStr && explicitDocTypeStr !== 'other'
      ? (explicitDocTypeStr === 'notes' || explicitDocTypeStr === 'summary')
      : (!isMarkScheme && !isQuestionPaper && (lowerName.includes('note') || lowerName.includes('not') || lowerName.includes('ozet') || lowerName.includes('özet')))
  );

  // Konuları güvenli şekilde formatla
  const parsedTopics = formatTopics(file.topics, file.topic_tag);
  const isAllTopics = parsedTopics.includes('ALL') || 
                      parsedTopics.includes('Hepsi') || 
                      file.topic_tag === 'ALL' || 
                      file.topic_tag === 'Hepsi';
  const regularTopics = parsedTopics.filter(t => t !== 'ALL' && t !== 'Hepsi');

  // Formatlı dosya boyutu
  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Formatlı yükleme tarihi
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

  const uploaderName = file.uploader_name ? (file.uploader_name.startsWith('@') ? file.uploader_name : `@${file.uploader_name}`) : '@öğrenci';
  const formattedSize = formatFileSize(file.size);
  const uploadDate = formatUploadDate(file.created_at);

  // Dosya ikon ve renk temasını belirle
  const getFileIconConfig = () => {
    const ext = fileExt.toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (isMarkScheme) {
      return {
        icon: <Target className="w-5 h-5 text-emerald-500" />,
        bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/20 dark:border-emerald-800/60',
        badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
      };
    }
    if (mime.includes('pdf') || ext === 'pdf') {
      return {
        icon: <FileText className="w-5 h-5 text-rose-500" />,
        bgColor: 'bg-rose-500/10 dark:bg-rose-950/40 border-rose-500/20 dark:border-rose-800/60',
        badgeColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
      };
    }
    if (mime.includes('word') || ['doc', 'docx'].includes(ext)) {
      return {
        icon: <FileText className="w-5 h-5 text-blue-500" />,
        bgColor: 'bg-blue-500/10 dark:bg-blue-950/40 border-blue-500/20 dark:border-blue-800/60',
        badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
      };
    }
    if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx'].includes(ext)) {
      return {
        icon: <FileSpreadsheet className="w-5 h-5 text-emerald-500" />,
        bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/20 dark:border-emerald-800/60',
        badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
      };
    }
    if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
      return {
        icon: <Presentation className="w-5 h-5 text-amber-500" />,
        bgColor: 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/20 dark:border-amber-800/60',
        badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
      };
    }
    if (['zip', 'rar', '7z'].includes(ext)) {
      return {
        icon: <FileArchive className="w-5 h-5 text-purple-500" />,
        bgColor: 'bg-purple-500/10 dark:bg-purple-950/40 border-purple-500/20 dark:border-purple-800/60',
        badgeColor: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
      };
    }
    return {
      icon: <FileIcon className="w-5 h-5 text-slate-500" />,
      bgColor: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    };
  };

  const iconConfig = getFileIconConfig();

  // Önizleme veya indirme işlemi
  const handlePrimaryClick = () => {
    if (isPdf) {
      onPreviewPdf(getApiUrl(file.url), rawFilename);
    } else {
      window.open(getApiUrl(file.url), '_blank');
    }
  };

  return (
    <div className="w-full bg-slate-900/60 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
      
      {/* SOL BLOK: İkon + Tam Dosya Adı + Etiketler */}
      <div className="flex items-start gap-4 flex-1 min-w-0">
        {/* İkon */}
        <div className={`p-3 rounded-xl shrink-0 border mt-0.5 ${
          isMarkScheme 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {isMarkScheme ? <CheckCircle2 className="w-6 h-6"/> : <FileText className="w-6 h-6"/>}
        </div>

        {/* Başlık ve Etiket Alanı */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* KESİNTİSİZ TAM DOSYA ADI */}
          <h3 
            onClick={handlePrimaryClick}
            className="text-sm sm:text-base font-semibold text-slate-100 hover:text-sky-400 cursor-pointer break-words whitespace-normal leading-relaxed"
          >
            {rawFilename}
          </h3>

          {/* Rozetler ve Konular */}
          <div className="flex flex-wrap items-center gap-2">
            {isQuestionPaper && isMarkScheme && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-gradient-to-r from-sky-500/20 via-indigo-500/20 to-emerald-500/20 border border-sky-400/40 text-sky-200 shadow-xs">
                📝 Soru Kağıdı + 🎯 Mark Scheme
              </span>
            )}
            {isQuestionPaper && !isMarkScheme && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-sky-500/15 border border-sky-500/30 text-sky-300">
                📝 Soru Kağıdı
              </span>
            )}
            {isMarkScheme && !isQuestionPaper && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                🎯 Mark Scheme
              </span>
            )}
            {!isMarkScheme && !isQuestionPaper && isNotes && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                📖 Ders Notu
              </span>
            )}
            {isAllTopics && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <Sparkles size={12} className="text-amber-400" />
                <span>⭐ Tüm Müfredat / Genel</span>
              </span>
            )}
            {!isAllTopics && regularTopics.map((topic, i) => (
              <span key={i} className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800/90 border border-slate-700/60 text-slate-300">
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* SAĞ BLOK: Boyut / Yükleyen / Tarih & Hızlı Aksiyonlar */}
      <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
        {/* Meta Bilgiler */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 font-medium">
          {canViewDownloads && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onViewDownloadHistory?.(file);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-sky-200 border border-sky-500/30 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="İndirme Geçmişini Görüntüle (Yalnızca Emirgan / ROOT)"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>{file.download_count ?? 0} İndirme</span>
            </button>
          )}
          <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700/50">
            {formattedSize}
          </span>
          <span>•</span>
          <span className="text-slate-300 font-medium">@{uploaderName.replace(/^@/, '')}</span>
          {uploadDate && (
            <>
              <span>•</span>
              <span className="text-slate-500">{uploadDate}</span>
            </>
          )}
        </div>

        {/* İşlem Butonları */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handlePrimaryClick();
            }} 
            className="p-2.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer" 
            title="Önizle"
          >
            <Eye className="w-4 h-4 sm:w-5 sm:h-5"/>
          </button>
          <a 
            href={getApiUrl(`/api/files/${file.id}/download`)}
            download={rawFilename}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()} 
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer" 
            title="İndir"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5"/>
          </a>
          {canDelete && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onInitiateDelete(file);
              }} 
              className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/15 rounded-xl transition-colors cursor-pointer" 
              title="Dosyayı Sil"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-400"/>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default CourseMaterialCard;
