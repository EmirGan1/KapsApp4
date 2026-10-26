import React, { useState } from 'react';
import { 
  Calculator, 
  GraduationCap, 
  Sparkles, 
  Award, 
  BookOpen, 
  Sliders, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  Zap, 
  ShieldCheck, 
  FileText,
  UserCheck,
  TrendingUp,
  BookmarkCheck
} from 'lucide-react';
import KapIBCalculator from './KapIBCalculator';
import KilicKepenekCalculator from './KilicKepenekCalculator';

interface KapsculatorHubProps {
  currentUserRoles?: string[];
}

export type KapsculatorVersion = 'hub' | 'original' | 'kilic_kepenek';

export default function KapsculatorHub({ currentUserRoles = [] }: KapsculatorHubProps) {
  const [activeVersion, setActiveVersion] = useState<KapsculatorVersion>('hub');

  // If a specific calculator version is active, render it with back-to-hub and cross-switch handlers
  if (activeVersion === 'original') {
    return (
      <KapIBCalculator 
        currentUserRoles={currentUserRoles}
        onBackToHub={() => setActiveVersion('hub')}
        onSwitchToKilicKepenek={() => setActiveVersion('kilic_kepenek')}
      />
    );
  }

  if (activeVersion === 'kilic_kepenek') {
    return (
      <KilicKepenekCalculator 
        onBackToHub={() => setActiveVersion('hub')}
        onSwitchToOriginal={() => setActiveVersion('original')}
      />
    );
  }

  // --- KAPSCULATOR HUB HOMEPAGE ---
  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 bg-slate-950 text-slate-100 overflow-y-auto">
      
      {/* Background Ambience Glow */}
      <div className="relative overflow-hidden w-full">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Hero Header */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 text-center">
          
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 border border-slate-700/80 text-xs font-bold text-slate-200 mb-4 shadow-sm backdrop-blur-md">
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span>KapsApp IB Diploma Studio & Grade Boundary Engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
            KapsCulator <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">Portal</span>
          </h1>
          
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Resmî IB Diploma not sınırları, mock denemeleri ve predicted grade hesaplamaları için kullanmak istediğiniz motoru seçin.
          </p>
        </div>

        {/* TWO BIG INTERACTIVE CARDS */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
            
            {/* BOX 1: KapsCulator Original */}
            <div 
              onClick={() => setActiveVersion('original')}
              className="group relative rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-indigo-950/30 border border-indigo-500/30 hover:border-indigo-400/80 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/20 flex flex-col justify-between cursor-pointer hover:-translate-y-1"
            >
              {/* Corner Ambient Glow */}
              <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-300 -z-10" />

              <div>
                {/* Header Badge & Version */}
                <div className="flex items-center justify-between gap-2 mb-5">
                  <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-wider border border-indigo-500/30 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-indigo-400" />
                    <span>KapsApp Resmî Sürüm</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/60">
                    v3.0 Full Pack
                  </span>
                </div>

                {/* Icon & Title */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-300 shrink-0">
                    <Calculator size={30} />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white group-hover:text-indigo-300 transition-colors tracking-tight">
                      KapsCulator Original
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-indigo-400 mt-0.5">
                      KapsApp Tam Donanımlı IB Diploma Hesaplayıcısı
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                  Profilinizdeki ders rolleriyle tam entegre çalışır. Türkçe A (Paper 1+2 & Bireysel Sözlü), İngilizce B (Individual Oral) ve 2026 fen/matematik müfredatındaki IA bileşenlerini resmi ağırlıklarla simüle eder.
                </p>

                {/* Feature Bullet Points */}
                <div className="space-y-2.5 mb-6 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                    <span><strong>Profil Rol Entegrasyonu:</strong> Kullanıcı ders rollerine göre otomatik listeleme</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                    <span><strong>Tam IA & Sözlü Desteği:</strong> Paper 1, Paper 2, Paper 3, IA ve IO ağırlıkları</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                    <span><strong>Mayıs 2025/2026 Resmî Sınırları:</strong> 16 IB dersi için doğrulanmış not aralıkları</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                    <span><strong>Esnek Dönüşüm:</strong> SL ⇄ HL tek tıkla seviye geçişi ve dinamik ders kataloğu</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                    <span><strong>45 Puanlık IB Matrisi:</strong> EE/TOK Core puanları ve detaylı özet rapor</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 group-hover:gap-3 transition-all cursor-pointer"
                >
                  <span>KapsCulator Original'ı Başlat</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>

            {/* BOX 2: Kılıç Kepenek Version */}
            <div 
              onClick={() => setActiveVersion('kilic_kepenek')}
              className="group relative rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-emerald-950/30 border border-emerald-500/30 hover:border-emerald-400/80 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/20 flex flex-col justify-between cursor-pointer hover:-translate-y-1"
            >
              {/* Corner Ambient Glow */}
              <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-300 -z-10" />

              <div>
                {/* Header Badge & Version */}
                <div className="flex items-center justify-between gap-2 mb-5">
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1.5">
                    <Award size={13} className="text-emerald-400" />
                    <span>Enis Kılıç Kepenek Production</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/60">
                    No-IA Dynamic Model
                  </span>
                </div>

                {/* Icon & Title */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-300 shrink-0">
                    <GraduationCap size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white group-hover:text-emerald-300 transition-colors tracking-tight">
                      Kılıç Kepenek Version
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-emerald-400 mt-0.5">
                      NO-IA Dynamic Grade Mapper & Boundary Setup
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                  Sadece yazılı sınav ve deneme odaklı (No-IA), Digital Society HL, Turkish A SL, Math AA HL, English B HL, Turkey in the 20th Century SL ve Physics SL için optimize edilmiş dinamik mock hesaplayıcısı.
                </p>

                {/* Feature Bullet Points */}
                <div className="space-y-2.5 mb-6 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>NO-IA Prensibi:</strong> Sadece saf sınavlar (Paper 1, Paper 2, Paper 3) üzerinden hesaplama</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Esnek Hesaplama Formülleri:</strong> Ham Toplam (Sum) veya Özel Yüzde Ağırlığı (%)</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Termometre & Sınır Göstergesi:</strong> Renkli skaler bar ve bir üst nota kalan net yüzde</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Canlı Boundary Editörü:</strong> 7'den 1'e tüm not yüzdesi sınırlarını anında özelleştirme</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Resmî Transkript Simülasyonu:</strong> EE & TOK puanlı IB sonuç belgesi önizlemesi</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 group-hover:gap-3 transition-all cursor-pointer"
                >
                  <span>Kılıç Kepenek Version'u Başlat</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* COMPARISON TABLE / MATRIX */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 pt-4">
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800/90 p-5 sm:p-7 backdrop-blur-md">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Layers size={16} className="text-indigo-400" />
              <span>Hangi Versiyonu Tercih Etmelisiniz?</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold">
                    <th className="py-2.5 px-3">Özellik / Kriter</th>
                    <th className="py-2.5 px-3 text-indigo-400 font-extrabold">KapsCulator Original</th>
                    <th className="py-2.5 px-3 text-emerald-400 font-extrabold">Kılıç Kepenek Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">IA & Bireysel Sözlü (IO)</td>
                    <td className="py-2.5 px-3">Dahili (Her dersin IA/Sözlü katsayısı mevcuttur)</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-300">No-IA (Saf yazılı sınav ve deneme odaklı)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Ders Kapsamı</td>
                    <td className="py-2.5 px-3">16 IB Dersi Kataloğu + Profil Rolleri Otomasyonu</td>
                    <td className="py-2.5 px-3">Digital Society, Turkish A, Math AA, English B, Turkey 20th, Physics</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Hesaplama Formülü</td>
                    <td className="py-2.5 px-3">Resmi müfredat ağırlıklı katsayı sistemi</td>
                    <td className="py-2.5 px-3">Ham Puan Toplamı (Sum) & Özel Yüzde Ağırlığı (%)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Sınır Düzenleme</td>
                    <td className="py-2.5 px-3">Mayıs 2024 / 2025 / 2026 resmî sınırları kataloğu</td>
                    <td className="py-2.5 px-3">Canlı ve anında düzenlenebilir Min/Maks yüzde ayarı</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Görsel Araçlar</td>
                    <td className="py-2.5 px-3">Kapsamlı Özet Modal, Dairesel Gösterge, Radar Analizi</td>
                    <td className="py-2.5 px-3">İnteraktif Renkli Termometre Barı & Resmi Transkript Kartı</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
