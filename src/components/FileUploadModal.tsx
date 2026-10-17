import React, { useState, useEffect } from 'react';
import { 
  X, 
  UploadCloud, 
  Check, 
  FileText, 
  Layers, 
  Sparkles, 
  AlertCircle, 
  FileSpreadsheet, 
  FileArchive, 
  Presentation, 
  FileCode, 
  File as FileIcon,
  Tag,
  Target,
  BookOpen,
  FolderArchive,
  Info
} from 'lucide-react';

export type DocumentType = 'question_paper' | 'mark_scheme' | 'notes' | 'summary' | 'both' | 'other';

export interface FileUploadPayload {
  file: File;
  selectedTopics: string[];
  allTopics: boolean;
  note: string;
  docType: DocumentType;
}

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingFile: File | null;
  courseTitle: string;
  courseThemes: string[];
  isUploading: boolean;
  onUpload: (payload: FileUploadPayload) => Promise<void>;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  pendingFile,
  courseTitle,
  courseThemes,
  isUploading,
  onUpload
}) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [allTopicsSelected, setAllTopicsSelected] = useState<boolean>(false);
  const [fileNote, setFileNote] = useState<string>('');
  const [docType, setDocType] = useState<DocumentType>('question_paper');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-detect document type from filename when modal opens
  useEffect(() => {
    if (isOpen && pendingFile) {
      setSelectedTopics([]);
      setAllTopicsSelected(false);
      setFileNote('');
      setValidationError(null);

      const lowerName = pendingFile.name.toLowerCase();
      const hasMS = lowerName.includes('markscheme') || lowerName.includes('_ms') || lowerName.includes('ms.') || lowerName.includes('cevap') || lowerName.includes('cozum') || lowerName.includes('çözüm');
      const hasQP = lowerName.includes('paper') || lowerName.includes('exam') || lowerName.includes('deneme') || lowerName.includes('soru') || lowerName.includes('test');

      if (hasMS && hasQP) {
        setDocType('both');
      } else if (hasMS) {
        setDocType('mark_scheme');
      } else if (hasQP) {
        setDocType('question_paper');
      } else if (
        lowerName.includes('note') || 
        lowerName.includes('not') || 
        lowerName.includes('ozet') || 
        lowerName.includes('özet') || 
        lowerName.includes('summary')
      ) {
        setDocType('notes');
      } else {
        setDocType('other');
      }
    }
  }, [isOpen, pendingFile]);

  // Prevent background body scroll when FileUploadModal is active on mobile
  useEffect(() => {
    if (!isOpen || !pendingFile) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, [isOpen, pendingFile]);

  // Toggle "Tüm Konular (Hepsi)"
  const handleToggleAll = () => {
    if (allTopicsSelected) {
      setAllTopicsSelected(false);
      setSelectedTopics([]);
    } else {
      setAllTopicsSelected(true);
      setSelectedTopics([...courseThemes]);
    }
    setValidationError(null);
  };

  // Toggle single topic
  const handleToggleTopic = (topic: string) => {
    setValidationError(null);
    if (selectedTopics.includes(topic)) {
      const next = selectedTopics.filter((t) => t !== topic);
      setSelectedTopics(next);
      if (allTopicsSelected) {
        setAllTopicsSelected(false);
      }
    } else {
      const next = [...selectedTopics, topic];
      setSelectedTopics(next);
      if (courseThemes.length > 0 && next.length === courseThemes.length) {
        setAllTopicsSelected(true);
      }
    }
  };

  const handleRemoveTopic = (topic: string) => {
    handleToggleTopic(topic);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile) return;
    if (selectedTopics.length === 0 && !allTopicsSelected) {
      setValidationError("Lütfen en az bir konu seçin veya '⭐ Tüm Müfredat (Hepsi)' seçeneğini işaretleyin.");
      return;
    }

    await onUpload({
      file: pendingFile,
      selectedTopics: allTopicsSelected ? ["ALL"] : selectedTopics,
      allTopics: allTopicsSelected,
      note: fileNote.trim(),
      docType
    });
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (filename: string, mimetype: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (mimetype.includes('pdf') || ext === 'pdf') {
      return <FileText className="w-8 h-8 text-rose-500" />;
    }
    if (mimetype.includes('word') || ['doc', 'docx'].includes(ext)) {
      return <FileText className="w-8 h-8 text-blue-500" />;
    }
    if (mimetype.includes('sheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
    }
    if (mimetype.includes('presentation') || ['ppt', 'pptx'].includes(ext)) {
      return <Presentation className="w-8 h-8 text-amber-500" />;
    }
    if (mimetype.includes('zip') || mimetype.includes('rar') || ['zip', 'rar', '7z'].includes(ext)) {
      return <FileArchive className="w-8 h-8 text-purple-500" />;
    }
    if (['py', 'js', 'ts', 'html', 'css', 'json', 'cpp', 'java'].includes(ext)) {
      return <FileCode className="w-8 h-8 text-cyan-500" />;
    }
    return <FileIcon className="w-8 h-8 text-slate-500" />;
  };

  // Early return after ALL hooks have been unconditionally called
  if (!isOpen || !pendingFile) return null;

  return (
    <div 
      onClick={() => {
        if (!isUploading) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[92vh] pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Ders Materyali Yükle
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {courseTitle} dersi için tür ve konu sınıflandırması
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form 
          onSubmit={handleSubmit} 
          className="p-5 sm:p-6 overflow-y-auto overscroll-contain touch-pan-y space-y-5 flex-1 min-h-0 scrollbar-thin"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          
          {/* File Overview Card */}
          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl">
            <div className="shrink-0 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-100 dark:border-slate-700">
              {getFileIcon(pendingFile.name, pendingFile.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words line-clamp-2">
                {pendingFile.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">{formatFileSize(pendingFile.size)}</span>
                <span>•</span>
                <span className="truncate">{pendingFile.type || "Belge"}</span>
              </div>
            </div>
          </div>

          {/* 1. DOSYA TÜRÜ (DOC TYPE) SEÇİCİ */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              Materyal Türü (Doc Type)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Soru Kağıdı */}
              <button
                type="button"
                onClick={() => setDocType('question_paper')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  docType === 'question_paper'
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 text-sky-900 dark:text-sky-200 ring-2 ring-sky-400/20 shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold flex items-center gap-1.5">
                    <span>📝 Soru Kağıdı</span>
                  </span>
                  {docType === 'question_paper' && (
                    <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px]">✓</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sadece Sınav / Deneme (Past Paper)
                </span>
              </button>

              {/* Cevap Anahtarı (Mark Scheme) */}
              <button
                type="button"
                onClick={() => setDocType('mark_scheme')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  docType === 'mark_scheme'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-400/20 shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span>🎯 Mark Scheme</span>
                  </span>
                  {docType === 'mark_scheme' && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sadece Cevap Anahtarı & Çözüm
                </span>
              </button>

              {/* İkisi Birlikte (Soru Kağıdı + Mark Scheme) */}
              <button
                type="button"
                onClick={() => setDocType('both')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 sm:col-span-2 ${
                  docType === 'both'
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-600 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-400/20 shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <span>💎 Soru Kağıdı + Mark Scheme (Çözümlü Sınav - İkisi Birlikte)</span>
                  </span>
                  {docType === 'both' && (
                    <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">✓</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hem soru kağıdını hem de cevap anahtarını içeren dosya
                </span>
              </button>

              {/* Ders Notu / Özet */}
              <button
                type="button"
                onClick={() => setDocType('notes')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  docType === 'notes' || docType === 'summary'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/20 shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold flex items-center gap-1.5">
                    <span>📖 Ders Notu / Özet</span>
                  </span>
                  {(docType === 'notes' || docType === 'summary') && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">✓</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Konu anlatımı ve formül kağıtları
                </span>
              </button>

              {/* Genel Materyal (Other) */}
              <button
                type="button"
                onClick={() => setDocType('other')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  docType === 'other'
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-white ring-2 ring-slate-400/20 shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold flex items-center gap-1.5">
                    <span>📁 Genel Materyal</span>
                  </span>
                  {docType === 'other' && (
                    <span className="w-4 h-4 rounded-full bg-slate-600 text-white flex items-center justify-center text-[10px]">✓</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  IA, sunum, ödev veya ek doküman
                </span>
              </button>
            </div>

            {docType === 'question_paper' && (
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 flex items-start gap-2 text-[11px] text-sky-800 dark:text-sky-300 mt-2">
                <Info className="w-4 h-4 shrink-0 text-sky-500 mt-0.5" />
                <p>
                  Soru kağıdını yükledikten sonra, ilgili <strong>Mark Scheme (Cevap Anahtarı)</strong> dosyasını da ayrı olarak yükleyerek arkadaşlarınızın çözümlerini kontrol etmesini sağlayabilirsiniz.
                </p>
              </div>
            )}
          </div>

          {/* 2. KONU / MÜFREDAT SEÇİM ALANI (Multi-Select) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Müfredat Konuları (Çoklu Seçim)
              </label>
              <span className="text-[11px] font-semibold text-slate-400">
                {allTopicsSelected ? "Tüm Müfredat" : `${selectedTopics.length} konu seçildi`}
              </span>
            </div>

            {/* "Tüm Konular (Hepsi)" Özel Buton */}
            <button
              type="button"
              onClick={handleToggleAll}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer font-medium ${
                allTopicsSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30"
                  : "bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                  allTopicsSelected ? "bg-white/20 text-white" : "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400"
                }`}>
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold">⭐ Tüm Müfredat / Genel</div>
                  <div className={`text-[11px] ${allTopicsSelected ? "text-indigo-100" : "text-indigo-600/70 dark:text-indigo-400/70"}`}>
                    Tüm konuları içeren deneme sınavı, formül kağıdı veya genel özet
                  </div>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                allTopicsSelected ? "bg-white text-indigo-600 border-white" : "border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800"
              }`}>
                {allTopicsSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>

            {/* Konu Çipleri (Chips / Tag Picker) */}
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-1 scrollbar-thin">
              {courseThemes.map((theme) => {
                const isSelected = selectedTopics.includes(theme);
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => handleToggleTopic(theme)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer select-none text-left ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-indigo-600 dark:border-indigo-600 shadow-xs ring-1 ring-slate-900 dark:ring-indigo-400"
                        : "bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border text-[9px] ${
                      isSelected ? "bg-white text-slate-900 dark:text-indigo-600 border-white" : "border-slate-300 dark:border-slate-600"
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                    <span>{theme}</span>
                  </button>
                );
              })}
            </div>

            {/* Seçilen Konu Rozetleri */}
            {selectedTopics.length > 0 && !allTopicsSelected && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
                  Seçilen Etiketler:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTopics.map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 text-[11px] font-medium"
                    >
                      <Tag className="w-2.5 h-2.5 text-indigo-500" />
                      <span className="truncate max-w-[200px]">{topic}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(topic)}
                        className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-100 hover:bg-indigo-200/50 dark:hover:bg-indigo-900 rounded-sm p-0.5 cursor-pointer ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {validationError && (
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-900/60 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* 3. Not / Açıklama */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Dosya Açıklaması / Not (İsteğe Bağlı)
            </label>
            <input
              type="text"
              value={fileNote}
              onChange={(e) => setFileNote(e.target.value)}
              placeholder="Örn: May 2024 Timezone 1 çözümleri, önemli formüller..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Yükleniyor...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Materyali Yükle</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default FileUploadModal;
