import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  FileText, 
  UploadCloud, 
  Download, 
  Eye, 
  Trash2, 
  X, 
  FileSpreadsheet, 
  FileArchive, 
  Presentation, 
  FileCode, 
  File, 
  Loader2, 
  Plus, 
  ExternalLink,
  GraduationCap,
  Tag,
  AlertCircle,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../utils/api';
import Avatar from './Avatar';

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
  created_at: string;
}

interface CourseFilesManagerProps {
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
  
  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [themeValidationError, setThemeValidationError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string>('');

  // Filter State
  const [selectedFilterTheme, setSelectedFilterTheme] = useState<string>('all');

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
    setSelectedTheme('');
    setThemeValidationError(null);
    setIsUploadModalOpen(true);
  };

  // Submit file upload with mandatory IB Theme
  const handleUploadSubmit = async () => {
    if (!pendingFile) return;

    if (!selectedTheme || !selectedTheme.trim()) {
      setThemeValidationError("Lütfen IB müfredatına uygun bir konu/tema seçin.");
      return;
    }

    setIsUploading(true);
    setThemeValidationError(null);

    const formData = new FormData();
    formData.append("file", pendingFile);
    formData.append("topic_tag", selectedTheme);
    formData.append("ib_theme", selectedTheme);
    if (fileNote.trim()) {
      formData.append("note", fileNote.trim());
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
      setSelectedTheme('');
      setFileNote('');
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

  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (mimetype: string, filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (mimetype.includes('pdf') || ext === 'pdf') {
      return <FileText className="w-6 h-6 text-rose-500" />;
    }
    if (mimetype.includes('word') || ['doc', 'docx'].includes(ext)) {
      return <FileText className="w-6 h-6 text-blue-500" />;
    }
    if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || ['xls', 'xlsx'].includes(ext)) {
      return <FileSpreadsheet className="w-6 h-6 text-emerald-500" />;
    }
    if (mimetype.includes('presentation') || mimetype.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
      return <Presentation className="w-6 h-6 text-amber-500" />;
    }
    if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('tar') || ['zip', 'rar', '7z'].includes(ext)) {
      return <FileArchive className="w-6 h-6 text-purple-500" />;
    }
    return <File className="w-6 h-6 text-slate-500" />;
  };

  const isPdfFile = (mimetype: string, filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return mimetype.includes('pdf') || ext === 'pdf';
  };

  // Filtered files list
  const filteredFiles = files.filter(f => {
    if (selectedFilterTheme === 'all') return true;
    return f.topic_tag === selectedFilterTheme;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 my-4 shadow-sm">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <UploadCloud size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                Ders Materyalleri & Dosyalar
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1">
                <GraduationCap size={12} />
                <span>IB Müfredatı</span>
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              PDF, Word, Excel, PowerPoint ve Arşiv dokümanları ({files.length} Dosya)
            </p>
          </div>
        </div>

        {/* Upload Button */}
        <div>
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
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Materyal / Dosya Yükle</span>
          </button>
        </div>
      </div>

      {/* IB Theme Filter Chips (if files exist) */}
      {files.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/60">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1 mr-1">
            <Filter size={12} />
            <span>Filtrele:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedFilterTheme('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedFilterTheme === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tüm Konular ({files.length})
          </button>
          {courseThemes.map(theme => {
            const count = files.filter(f => f.topic_tag === theme).length;
            if (count === 0) return null;
            return (
              <button
                key={theme}
                type="button"
                onClick={() => setSelectedFilterTheme(theme)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedFilterTheme === theme
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {theme} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Files List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin text-blue-500" />
          <p className="text-xs">Ders materyalleri yükleniyor...</p>
        </div>
      ) : files.length === 0 ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-slate-800/30"
        >
          <UploadCloud size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            Henüz ders dosyası yüklenmemiş
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Buraya tıklayarak IB müfredatı temalı PDF, Word veya özet ders notlarınızı yükleyin
          </p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-xs">
          Bu temaya ait henüz dosya bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredFiles.map((file) => {
            const isOwner = Number(file.uploaded_by) === Number(currentUserId);
            const canDelete = isOwner || isEmirgan;
            const isPdf = isPdfFile(file.mimetype || '', file.original_name || file.filename);

            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-2xs group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shrink-0 shadow-2xs">
                    {getFileIcon(file.mimetype || '', file.original_name || file.filename)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate" title={file.original_name || file.filename}>
                      {file.original_name || file.filename}
                    </p>
                    
                    {/* IB Theme Badge */}
                    {file.topic_tag && (
                      <div className="mt-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 max-w-[200px] truncate">
                          <Tag size={10} className="shrink-0 text-indigo-500" />
                          <span className="truncate">{file.topic_tag}</span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span className="truncate">{file.uploader_name || 'Kullanıcı'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {isPdf && (
                    <button
                      onClick={() => {
                        setPreviewPdfUrl(getApiUrl(file.url));
                        setPreviewPdfTitle(file.original_name || file.filename);
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      title="PDF Önizle"
                    >
                      <Eye size={15} />
                    </button>
                  )}

                  <a
                    href={getApiUrl(file.url)}
                    download={file.original_name || file.filename}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="İndir"
                  >
                    <Download size={15} />
                  </a>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleInitiateDelete(file)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* MANDATORY IB THEME UPLOAD MODAL */}
      {/* =================================================================== */}
      {isUploadModalOpen && pendingFile && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                    Materyal Yükle & Paylaş
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {courseTitle} — IB Müfredat Teması Belirleyin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setPendingFile(null);
                  setSelectedTheme('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selected File Box */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shrink-0">
                {getFileIcon(pendingFile.type, pendingFile.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                  {pendingFile.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatFileSize(pendingFile.size)} • {pendingFile.type || 'Dosya'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                Değiştir
              </button>
            </div>

            {/* MANDATORY IB THEME SELECTOR */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <GraduationCap size={14} className="text-indigo-500" />
                  <span>İlgili IB Müfredatı Teması / Konusu</span>
                </span>
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                  * Zorunlu
                </span>
              </label>

              <select
                value={selectedTheme}
                onChange={(e) => {
                  setSelectedTheme(e.target.value);
                  if (e.target.value) {
                    setThemeValidationError(null);
                  }
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${
                  themeValidationError
                    ? 'border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              >
                <option value="">-- Lütfen bir IB Teması Seçin (Zorunlu) --</option>
                {courseThemes.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>

              {themeValidationError && (
                <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-1 animate-in fade-in">
                  <AlertCircle size={13} />
                  <span>{themeValidationError}</span>
                </p>
              )}
            </div>

            {/* Optional Note/Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Açıklama / Not Başlığı (İsteğe Bağlı)
              </label>
              <input
                type="text"
                value={fileNote}
                onChange={(e) => setFileNote(e.target.value)}
                placeholder="Örn: 2026 Paper 2 Çalışma Soruları ve Formül Listesi..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setPendingFile(null);
                  setSelectedTheme('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                İptal
              </button>

              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={!selectedTheme || isUploading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Yükleniyor...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Yükle ve Paylaş</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 shrink-0">
                <Trash2 size={22} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  Ders Dosyasını Sil
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Bu dosyayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
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

      {/* PDF Viewer Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            {/* Modal Header */}
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
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Download size={13} />
                  <span>İndir</span>
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body / PDF Iframe */}
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
