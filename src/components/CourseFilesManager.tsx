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
  ExternalLink 
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
  created_at: string;
}

interface CourseFilesManagerProps {
  courseId: string;
  courseTitle: string;
  socket?: Socket | null;
  currentUserId: number;
  currentUsername: string;
}

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
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEmirgan = currentUsername?.trim().toLowerCase() === 'emirgan';

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 300 * 1024 * 1024) {
      alert("Dosya boyutu çok büyük (Maksimum 300MB).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

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
      loadFiles();
    } catch (err: any) {
      alert(err.message || "Dosya yüklenirken bir hata oluştu.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!confirm("Bu ders dosyasını silmek istediğinize emin misiniz?")) return;
    setFiles((prev) => prev.filter((f) => f.id !== fileId));

    try {
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      await fetch(getApiUrl(`/api/courses/files/${fileId}`), {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      loadFiles();
    } catch (e) {
      console.error("Error deleting file:", e);
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

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 my-4 shadow-sm">
      
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <UploadCloud size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Ders Materyalleri & Dosyalar
            </h3>
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
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Yükleniyor...</span>
              </>
            ) : (
              <>
                <Plus size={15} />
                <span>Dosya Yükle</span>
              </>
            )}
          </button>
        </div>
      </div>

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
            Buraya tıklayarak PDF, Word veya özet ders notlarınızı yükleyin
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {files.map((file) => {
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
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
