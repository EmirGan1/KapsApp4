import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { 
  FileText, 
  UploadCloud, 
  Download, 
  X, 
  Loader2, 
  Plus, 
  GraduationCap,
  Filter,
  Search,
  LayoutGrid,
  List,
  Trash2,
  HardDrive
} from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../utils/api';
import FileUploadModal from './FileUploadModal';
import CourseMaterialCard, { parseTopics } from './CourseMaterialCard';

export interface CourseFileItem {
  id: number;
  folder_id: string;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  url: string;
  uploaded_by: number;
  uploader_name?: string;
  uploader_avatar?: string;
  topic_tag?: string | null;
  topics?: string[];
  created_at: string;
}

export interface CourseFilesManagerProps {
  courseId: string;
  courseTitle: string;
  socket?: Socket | null;
  currentUserId: number;
  currentUsername: string;
}

export const COURSE_IB_THEMES: Record<string, string[]> = {
  "Mathematics": [
    "Number and Algebra",
    "Functions",
    "Geometry and Trigonometry",
    "Statistics and Probability",
    "Calculus"
  ],
  "Math": [
    "Number and Algebra",
    "Functions",
    "Geometry and Trigonometry",
    "Statistics and Probability",
    "Calculus"
  ],
  "Physics": [
    "Space, Time and Motion",
    "The Particulate Nature of Matter",
    "Wave Behaviour",
    "Fields",
    "Nuclear and Quantum Physics"
  ],
  "Digital Society": [
    "Systems",
    "Media and Communities",
    "Data and Algorithms",
    "Digital Security and Ethics"
  ],
  "TITC": [
    "1. Ünite: Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti (1595-1774)",
    "2. Ünite: Değişim Çağında Avrupa ve Osmanlı",
    "3. Ünite: Uluslararası İlişkilerde Denge Stratejisi (1774-1914)",
    "4. Ünite: Devrimler Çağında Değişen Devlet-Toplum İlişkileri",
    "5. Ünite: Sermaye ve Emek",
    "6. Ünite: XIX. ve XX. Yüzyılda Değişen Gündelik Hayat",
    "20. Yüzyıl Başlarında Dünya ve Türkiye"
  ],
  "Tarih": [
    "1. Ünite: Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti (1595-1774)",
    "2. Ünite: Değişim Çağında Avrupa ve Osmanlı",
    "3. Ünite: Uluslararası İlişkilerde Denge Stratejisi (1774-1914)",
    "4. Ünite: Devrimler Çağında Değişen Devlet-Toplum İlişkileri",
    "5. Ünite: Sermaye ve Emek",
    "6. Ünite: XIX. ve XX. Yüzyılda Değişen Gündelik Hayat",
    "20. Yüzyıl Başlarında Dünya ve Türkiye"
  ],
  "English": [
    "Language and Culture",
    "Literature and Textual Analysis",
    "Perspectives and Context",
    "Essay and Commentary Writing",
    "Paper 1 & Paper 2 Prep"
  ],
  "Chemistry": [
    "Structure 1: Models of the particulate nature of matter",
    "Structure 2: Models of bonding and structure",
    "Reactivity 1: What drives chemical reactions?",
    "Reactivity 2: How much, how fast and how far?",
    "Reactivity 3: What are the mechanisms of chemical change?"
  ],
  "Biology": [
    "Unity and Diversity (Cells, Organisms)",
    "Molecular Biology & Genetics",
    "Continuity and Change (Genetics, Evolution)",
    "Form and Function (Physiology)",
    "Interaction and Interdependence (Ecology)"
  ],
  "Turkish": [
    "Metin Türleri ve İnceleme",
    "Edebi Akımlar ve Dönemler",
    "Şiir ve Tiyatro Tahlili",
    "Roman ve Hikaye Çözümlemeleri",
    "Dil Bilgisi ve Anlatım"
  ]
};

export const DEFAULT_IB_THEMES = [
  "Genel Ders Notları & Özetler",
  "Soru Çözümleri & Örnekler",
  "IA / Proje & Araştırma Materyalleri",
  "Geçmiş Sınav Soruları (Past Papers)"
];

export const CourseFilesManager: React.FC<CourseFilesManagerProps> = ({
  courseId,
  courseTitle,
  socket,
  currentUserId,
  currentUsername
}) => {
  const [files, setFiles] = useState<CourseFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // Search & Filter State
  const [selectedFilterTheme, setSelectedFilterTheme] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Preview & Delete State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState<string>('');
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<CourseFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEmirgan = currentUsername?.trim().toLowerCase() === 'emirgan';

  // Get themes for this specific course
  const courseThemes = COURSE_IB_THEMES[courseTitle] || 
    COURSE_IB_THEMES[courseId] || 
    COURSE_IB_THEMES[Object.keys(COURSE_IB_THEMES).find(k => courseTitle.toLowerCase().includes(k.toLowerCase()) || courseId.toLowerCase().includes(k.toLowerCase())) || ''] || 
    DEFAULT_IB_THEMES;

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/courses/${encodeURIComponent(courseId)}/files`), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error("Error loading course files:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();

    if (socket) {
      const handleFolderUpdated = (data: any) => {
        if (!data?.folderId || data.folderId === courseId) {
          loadFiles();
        }
      };
      socket.on("folder_files_updated", handleFolderUpdated);
      socket.on("subjects_updated", loadFiles);
      socket.on("file:deleted", loadFiles);

      return () => {
        socket.off("folder_files_updated", handleFolderUpdated);
        socket.off("subjects_updated", loadFiles);
        socket.off("file:deleted", loadFiles);
      };
    }
  }, [courseId, socket]);

  // When user selects a file via hidden input
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeInMB = (file.size || 0) / (1024 * 1024);
    if (fileSizeInMB > 300) {
      alert(`Dosya boyutu çok büyük (Maksimum 300MB). Seçilen Dosya: ${file.name}\nBoyut: ${fileSizeInMB.toFixed(2)} MB`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPendingFile(file);
    setIsUploadModalOpen(true);
  };

  // Submit file upload with multi-topic and allTopics support
  const handleUploadSubmit = async (payload: {
    file: File;
    selectedTopics: string[];
    allTopics: boolean;
    note: string;
  }) => {
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", payload.file);
    formData.append("allTopics", payload.allTopics ? "true" : "false");
    formData.append("topics", JSON.stringify(payload.selectedTopics));
    payload.selectedTopics.forEach((t) => formData.append("topics[]", t));

    const primaryTag = payload.allTopics ? "ALL" : (payload.selectedTopics[0] || "Genel");
    formData.append("topic_tag", primaryTag);
    formData.append("ib_theme", primaryTag);

    if (payload.note) {
      formData.append("note", payload.note);
    }

    try {
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/api/courses/${encodeURIComponent(courseId)}/files`), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error("Dosya boyutu çok büyük (Maksimum 300MB).");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Dosya yüklenemedi (${res.status}).`);
      }

      const data = await res.json();
      if (data.file) {
        setFiles((prev) => [data.file, ...prev]);
      }
      setIsUploadModalOpen(false);
      setPendingFile(null);
      loadFiles();
    } catch (err: any) {
      alert(err.message || "Dosya yüklenirken bir hata oluştu.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleInitiateDelete = (file: CourseFileItem) => {
    setDeleteConfirmFile(file);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmFile) return;
    const fileId = deleteConfirmFile.id;
    
    // Instant reactive local update
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setIsDeleting(true);

    try {
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      await fetch(getApiUrl(`/api/courses/files/${fileId}`), {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      loadFiles();
    } catch (e) {
      console.error("Error deleting file:", e);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmFile(null);
    }
  };

  // Total size calculation
  const totalSizeBytes = useMemo(() => {
    return files.reduce((acc, curr) => acc + (curr.size || 0), 0);
  }, [files]);

  const formatTotalSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filtered files list: topic filter + search query
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const parsed = parseTopics(f.topics, f.topic_tag);
      const isAll = parsed.includes('ALL') || parsed.includes('Hepsi') || f.topic_tag === 'ALL' || f.topic_tag === 'Hepsi';

      // 1. Topic Filter
      if (selectedFilterTheme !== 'all') {
        const hasTopic = parsed.some(t => t.toLowerCase() === selectedFilterTheme.toLowerCase()) ||
                         (f.topic_tag && f.topic_tag.toLowerCase() === selectedFilterTheme.toLowerCase());
        if (!isAll && !hasTopic) return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const filename = (f.original_name || f.filename || '').toLowerCase();
        const uploader = (f.uploader_name || '').toLowerCase();
        const topicsMatch = parsed.some(t => t.toLowerCase().includes(q));

        if (!filename.includes(q) && !uploader.includes(q) && !topicsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [files, selectedFilterTheme, searchQuery]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 my-4 shadow-sm">
      
      {/* 1. Üst Başlık & Eylemler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
            <UploadCloud size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                Ders Materyalleri & Dosyalar
              </h3>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center gap-1">
                <GraduationCap size={12} />
                <span>IB Müfredatı</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span>PDF, Word, Slayt ve Özet Dokümanlar</span>
              <span>•</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{files.length} Dosya</span>
              {totalSizeBytes > 0 && (
                <>
                  <span>•</span>
                  <span className="text-slate-400 font-mono text-[11px]">{formatTotalSize(totalSizeBytes)}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Aksiyon Grubu: Arama & Yükleme Butonu */}
        <div className="flex items-center gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Materyal / Dosya Yükle</span>
          </button>
        </div>
      </div>

      {/* 2. Filtre ve Arama Araç Çubuğu */}
      <div className="space-y-3 mb-4">
        {/* Arama Kutusu ve Görünüm Değiştirici */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Dosya adı, konu veya yükleyen ara..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Grid / List Görünüm Seçici */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/70 shrink-0">
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                layoutMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Kılavuz (Grid) Görünümü"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                layoutMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Liste Görünümü"
            >
              <List size={15} />
            </button>
          </div>
        </div>

        {/* IB Konu Filtre Rozetleri */}
        {files.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1 mr-1">
              <Filter size={12} />
              <span>Konu:</span>
            </span>
            
            <button
              type="button"
              onClick={() => setSelectedFilterTheme('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedFilterTheme === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tüm Konular ({files.length})
            </button>

            {courseThemes.map((theme) => {
              const count = files.filter((f) => {
                const parsed = parseTopics(f.topics, f.topic_tag);
                const isAll = parsed.includes('ALL') || parsed.includes('Hepsi') || f.topic_tag === 'ALL';
                const hasTheme = parsed.some(t => t.toLowerCase() === theme.toLowerCase()) || 
                                 (f.topic_tag && f.topic_tag.toLowerCase() === theme.toLowerCase());
                return isAll || hasTheme;
              }).length;

              if (count === 0) return null;
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setSelectedFilterTheme(theme)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedFilterTheme === theme
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {theme} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Dosyalar Listesi */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2.5">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <p className="text-xs font-medium">Ders materyalleri yükleniyor...</p>
        </div>
      ) : files.length === 0 ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-slate-800/30 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <UploadCloud size={24} />
          </div>
          <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
            Henüz ders materyali veya dosya yüklenmemiş
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            Buraya tıklayarak PDF, Word veya özet ders notlarınızı IB konu başlıklarıyla etiketleyip yükleyin.
          </p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-6 space-y-2">
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
            Arama kriterinize uygun dosya bulunamadı.
          </p>
          <p className="text-[11px] text-slate-400">
            Farklı bir arama terimi deneyebilir veya konu filtresini sıfırlayabilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedFilterTheme('all');
            }}
            className="mt-2 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Filtreleri Temizle
          </button>
        </div>
      ) : (
        <div className={layoutMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4" : "flex flex-col gap-3"}>
          {filteredFiles.map((file) => (
            <CourseMaterialCard
              key={file.id}
              file={file}
              currentUserId={currentUserId}
              isEmirgan={isEmirgan}
              layoutMode={layoutMode}
              onPreviewPdf={(url, title) => {
                setPreviewPdfUrl(url);
                setPreviewPdfTitle(title);
              }}
              onInitiateDelete={handleInitiateDelete}
            />
          ))}
        </div>
      )}

      {/* 4. Çoklu Konu Seçimli Dosya Yükleme Modalı */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setPendingFile(null);
        }}
        pendingFile={pendingFile}
        courseTitle={courseTitle}
        courseThemes={courseThemes}
        isUploading={isUploading}
        onUpload={handleUploadSubmit}
      />

      {/* 5. Silme Onay Modalı */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 shrink-0">
                <Trash2 size={22} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  Ders Materyalini Sil
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Bu materyali silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs font-bold text-slate-700 dark:text-slate-200 break-words">
                  {deleteConfirmFile.original_name || deleteConfirmFile.filename}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmFile(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                İptal
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Siliniyor...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Evet, Sil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. PDF Önizleme Modalı */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            {/* Modal Başlığı */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText size={18} className="text-rose-500 shrink-0" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                  {previewPdfTitle}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  download={previewPdfTitle}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Download size={13} />
                  <span>İndir</span>
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Gövdesi / PDF Iframe */}
            <div className="flex-1 w-full h-full bg-slate-100 dark:bg-slate-950 relative">
              <iframe
                src={`${previewPdfUrl}#toolbar=1`}
                title={previewPdfTitle}
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CourseFilesManager;
