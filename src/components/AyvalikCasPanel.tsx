import AyvalikWeather from "./ayvalik/AyvalikWeather";
import {usePackingList} from "./ayvalik/usePackingList";
import {activityId,casDateLabel,readStringList,readReflectionDraft,downloadText,programCalendar} from "../utils/ayvalik";
import {useSearchParams} from "react-router-dom";
import AyvalikRooms from "./AyvalikRooms";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Socket } from "socket.io-client";
import { 
  CalendarDays, Clock, MapPin, CloudRain, Sun, Wind, Umbrella, 
  CheckCircle2, Circle, MessageSquare, Image, Video, Send, Plus, 
  Trash2, Heart, Download, ExternalLink, ShieldCheck, AlertTriangle, 
  Backpack, BookOpen, Hotel, Bus, Phone, FileText, Sparkles, 
  ChevronRight, ArrowLeft, RefreshCw, Eye, Award, Users, Filter, 
  X, Check, Flame, Radio, Droplets, Info, Megaphone
} from "lucide-react";
import Avatar from "./Avatar";
import { getApiUrl, getAuthHeaders } from "../utils/api";

const AYVALIK_SECTIONS = [
 {id:'schedule',title:'Gezi programı',description:'Üç günün etkinlikleri, buluşma saatleri ve rotaları.',icon:CalendarDays},
 {id:'rooms',title:'Oda seçimi',description:'2–3 kişilik odaları gör, oda aç ve arkadaşlarını davet et.',icon:Users},
 {id:'chat',title:'Gezi sohbeti',description:'Arkadaşlarınla haberleş, fotoğraf ve mesaj paylaş.',icon:MessageSquare},
 {id:'weather',title:'Hava ve giyim',description:'Gezi günleri için hava ve kıyafet rehberi.',icon:CloudRain},
 {id:'gallery',title:'Gezi galerisi',description:'Ortak anıları fotoğraf ve videolarla biriktir.',icon:Image},
 {id:'checklist',title:'Çanta kontrolü',description:'İhtiyaçlarını hazırla, tamamladıklarını işaretle.',icon:Backpack},
 {id:'reflections',title:'CAS günlüğü',description:'Deneyimlerini ve öğrenme çıktılarını kaydet.',icon:BookOpen},
 {id:'guide',title:'Otel ve rehber',description:'Konaklama, iletişim ve resmi gezi bilgileri.',icon:Hotel},
] as const;

export interface AyvalikCasPanelProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername: string;
  avatar: string | null;
  color?: string;
  currentUserRoles?: string[];
  isEmirgan?: boolean;
  onBackToMain?: () => void;
}

export interface CasMessage {
  id: number;
  sender_id: number;
  username: string;
  avatar: string | null;
  color?: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  is_pinned?: number;
  created_at: string;
}

export interface CasGalleryItem {
  id: number;
  user_id: number;
  username: string;
  user_avatar: string | null;
  user_color?: string;
  media_url: string;
  media_type: "image" | "video";
  caption?: string;
  day_tag?: string;
  location_tag?: string;
  likes_count: number;
  is_liked?: boolean;
  created_at: string;
}

export interface CasReflection {
  id: number;
  user_id: number;
  username: string;
  day_number: number;
  learning_outcome?: string;
  reflection_text: string;
  created_at: string;
}

// 3-Day Program Agenda derived strictly from the official Fora Turizm PDF brochure
export const AYVALIK_PROGRAM = [
  // 1. GÜN: 25 KASIM 2026
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "06:00",
    title: "Okuldan Hareket",
    description: "Okul bahçesinde toplanma ve lüks D2/B2 belgeli otobüsümüzle Ayvalık'a hareket. Araç içinde kahvaltı paketi ikramı yapılacaktır.",
    type: "transport",
    badge: "Yolculuk & Kahvaltı",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    location: "Okul Bahçesi",
    sdg: "Gidiş Başlangıcı",
    icon: "🚌"
  },
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "07:00",
    title: "İhtiyaç Molası",
    description: "Otoyol dinlenme tesisinde sabah ihtiyaç ve sıcak içecek molası.",
    type: "break",
    badge: "Mola",
    badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    location: "Dinlenme Tesisi",
    icon: "☕"
  },
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "11:15",
    title: "SERVICE: Kardeş Okul Saha Çalışması (1. Kısım)",
    description: "Kardeş okul öğrencileri ile buluşma ve tanışma. Basketbol, Futbol, Sanat, Yabancı Dil, Fen ve Dans Atölyeleri eşliğinde interaktif akran eğitimi ve toplum hizmeti çalışması.",
    type: "service",
    badge: "SERVICE (Toplum Hizmeti)",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    location: "Ayvalık Kardeş Okul Kampüsü",
    sdg: "SDG 4: Nitelikli Eğitim • SDG 10: Eşitsizliklerin Azaltılması",
    icon: "🤝"
  },
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "13:00",
    title: "Serbest Öğle Yemeği",
    description: "Kardeş okul ve ilçe merkezinde serbest öğle yemeği ve dinlenme vakti.",
    type: "meal",
    badge: "Öğle Yemeği",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    location: "Ayvalık Merkez",
    icon: "🍽️"
  },
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "14:00",
    title: "SERVICE: Saha Çalışması (2. Kısım)",
    description: "Atölyelerin 2. aşaması: Basketbol & Futbol maçları, Müzik & Dans gösterileri, Fen deneyleri ve ortak Sanat panosu üretimi.",
    type: "service",
    badge: "ACTION & CREATIVITY",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    location: "Kardeş Okul Spor ve Sanat Alanları",
    sdg: "SDG 3: Sağlık ve Kaliteli Yaşam • SDG 17: Amaçlar İçin Ortaklıklar",
    icon: "🎨"
  },
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "18:30",
    title: "Otele Varış ve Odalara Yerleşme",
    description: "4* Bacacan Otel Ayvalık'a varış, anahtar teslimi ve odalara yerleşme, dinlenme.",
    type: "hotel",
    badge: "Konaklama",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    location: "4* Bacacan Otel Ayvalık",
    icon: "🏨"
  },
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "19:30",
    title: "Değerlendirme Toplantısı (CAS Team Reflection)",
    description: "1. Günün kazanımları, öğrenci gözlemleri, kardeş okul işbirliği değerlendirmesi ve ertesi gün planlaması.",
    type: "reflection",
    badge: "CAS Reflection",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    location: "Otel Toplantı Salonu",
    icon: "📝"
  },
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "20:00",
    title: "Cunda Adası'na Transfer ve Akşam Yemeği",
    description: "Tarihi taş sokaklarıyla ünlü Cunda Adası'na hareket. Deniz kenarında toplu akşam yemeği (tura dahildir).",
    type: "meal",
    badge: "Akşam Yemeği & Kültür Gezisi",
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    location: "Cunda Adası Restoranı",
    icon: "🌙"
  },
  {
    day: 1,
    dateText: "25 Kasım 2026, Çarşamba",
    time: "22:30",
    title: "Otele Dönüş",
    description: "Otobüsle otele dönüş, serbest dinlenme ve gece istirahati.",
    type: "hotel",
    badge: "Otele Dönüş",
    badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    location: "4* Bacacan Otel",
    icon: "🛏️"
  },

  // 2. GÜN: 26 KASIM 2026
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "07:30",
    title: "Uyandırma ve Açık Büfe Kahvaltı",
    description: "Otel restoranında açık büfe sabah kahvaltısı ve güne hazırlık.",
    type: "meal",
    badge: "Kahvaltı",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    location: "Bacacan Otel Restoranı",
    icon: "🍳"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "09:00",
    title: "Otelden Hareket",
    description: "Küçükköy Yaratıcı Teknolojiler Atölyesi'ne transfer için otobüste toplanma.",
    type: "transport",
    badge: "Transfer",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    location: "Otel Önü",
    icon: "🚌"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "09:30",
    title: "SERVICE: Sabancı Üniversitesi Küçükköy Teknoloji Atölyeleri",
    description: "Sabancı Üniversitesi Küçükköy Yaratıcı Teknolojiler Atölyesi'nde kardeş okul öğrencileri ile buluşma: Robotik kodlama, 3D modelleme, dijital sanat ve bilim atölyeleri.",
    type: "service",
    badge: "CREATIVITY & SERVICE",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    location: "Sabancı Üni Küçükköy Yaratıcı Teknolojiler Merkezi",
    sdg: "SDG 9: Sanayi, Yenilikçilik ve Altyapı • SDG 4: Nitelikli Eğitim",
    icon: "💻"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "12:30",
    title: "Serbest Öğle Yemeği",
    description: "Küçükköy tarihi sokaklarında yerel lezzetler ve serbest zaman.",
    type: "meal",
    badge: "Öğle Yemeği",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    location: "Küçükköy Meydanı",
    icon: "🥪"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "14:00",
    title: "Müze Atölyesi: Anadolu Eserleri Müzesi",
    description: "Kardeş okul öğrencileri ile beraber 'Anadolu Eserleri Müzesi' ziyareti, arkeolojik ve kültürel miras atölye çalışması.",
    type: "museum",
    badge: "Kültür & Sanat",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    location: "Anadolu Eserleri Müzesi",
    sdg: "SDG 11: Sürdürülebilir Şehirler ve Topluluklar",
    icon: "🏛️"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "16:30",
    title: "Ayvalık Şeytan Sofrası Seyri & Serbest Zaman",
    description: "Tüm Ayvalık adaları ve Midilli manzarasını kuşbakışı gören efsanevi Şeytan Sofrası tepesinde serbest zaman ve gün batımı fotoğraf çekimi.",
    type: "sightseeing",
    badge: "Doğa & Fotoğraf",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    location: "Şeytan Sofrası Seyir Tepesi",
    icon: "🌄"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "18:30",
    title: "Otele Varış ve Dinlenme",
    description: "Otele dönüş ve akşam programı öncesi serbest dinlenme.",
    type: "hotel",
    badge: "Otel",
    badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    location: "Bacacan Otel",
    icon: "🏨"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "19:00",
    title: "Değerlendirme Toplantısı (CAS Team Reflection)",
    description: "2. Gün teknoloji atölyesi çıktıları, müze incelemeleri ve grup deneyimlerinin değerlendirilmesi.",
    type: "reflection",
    badge: "CAS Reflection",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    location: "Otel Salonu",
    icon: "📝"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "20:00",
    title: "Ayvalık Merkeze Transfer ve Akşam Yemeği",
    description: "Tarihi Ayvalık merkezine hareket ve akşam yemeği ikramı (tura dahildir).",
    type: "meal",
    badge: "Akşam Yemeği",
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    location: "Ayvalık Merkez Restoranı",
    icon: "🍲"
  },
  {
    day: 2,
    dateText: "26 Kasım 2026, Perşembe",
    time: "22:00",
    title: "Otele Dönüş",
    description: "Otele dönüş ve dinlenme.",
    type: "hotel",
    badge: "Otel",
    badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    location: "Bacacan Otel",
    icon: "🛏️"
  },

  // 3. GÜN: 27 KASIM 2026
  {
    day: 3,
    dateText: "27 Kasım 2026, Cuma",
    time: "07:30",
    title: "Uyandırma, Kahvaltı & Odaların Boşaltılması",
    description: "Kahvaltı ardından bavulların otobüse yüklenmesi ve çıkış işlemleri.",
    type: "meal",
    badge: "Check-out & Kahvaltı",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    location: "Bacacan Otel",
    icon: "🧳"
  },
  {
    day: 3,
    dateText: "27 Kasım 2026, Cuma",
    time: "09:00",
    title: "Otelden Hareket",
    description: "Kürşat zeytinliklerine hareket.",
    type: "transport",
    badge: "Transfer",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    location: "Otel Önü",
    icon: "🚌"
  },
  {
    day: 3,
    dateText: "27 Kasım 2026, Cuma",
    time: "09:30",
    title: "Kürşat Ayvalık ile Zeytin Hasadı Deneyimi",
    description: "Açık arazide geleneksel Ayvalık zeytin hasadı çalışması, zeytin ağaçları bakımı, tarımsal sürdürülebilirlik eğitimi ve hasatta aktif görev alma.",
    type: "action",
    badge: "ACTION & SUSTAINABILITY",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    location: "Kürşat Ayvalık Zeytin Bahçeleri",
    sdg: "SDG 12: Sorumlu Üretim ve Tüketim • SDG 15: Karasal Yaşam",
    icon: "🫒"
  },
  {
    day: 3,
    dateText: "27 Kasım 2026, Cuma",
    time: "11:00",
    title: "Zeytinyağı Endüstri Müzesi",
    description: "Zeytinin yağa dönüşüm serüveni, taş baskı makineleri, soğuk sıkım teknolojileri ve Ege zeytincilik tarihi müze rehberi eşliğinde incelenir.",
    type: "museum",
    badge: "Endüstri & Kültür Müzesi",
    badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    location: "Zeytinyağı Endüstri Müzesi",
    icon: "🏺"
  },
  {
    day: 3,
    dateText: "27 Kasım 2026, Cuma",
    time: "12:30",
    title: "Serbest Öğle Yemeği & Alışveriş",
    description: "Dönüş öncesi yöresel zeytinyağı ürünleri alışverişi ve serbest öğle yemeği.",
    type: "meal",
    badge: "Serbest Zaman",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    location: "Ayvalık Çarşısı",
    icon: "🛍️"
  },
  {
    day: 3,
    dateText: "27 Kasım 2026, Cuma",
    time: "14:30",
    title: "İstanbul'a Hareket",
    description: "Otobüsümüze binerek İstanbul'a doğru dönüş yolculuğunun başlaması.",
    type: "transport",
    badge: "Dönüş Yolculuğu",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    location: "Ayvalık - İstanbul Güzergahı",
    icon: "🛣️"
  },
  {
    day: 3,
    dateText: "27 Kasım 2026, Cuma",
    time: "16:30",
    title: "İhtiyaç Molası",
    description: "Yol güzergahındaki dinlenme tesisinde mola.",
    type: "break",
    badge: "Mola",
    badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    location: "Otoyol Tesisleri",
    icon: "☕"
  },
  {
    day: 3,
    dateText: "27 Kasım 2026, Cuma",
    time: "20:00",
    title: "Okula Varış ve Turun Sonu",
    description: "Okul bahçesine varış, velilere teslim ve Ayvalık CAS 2026 projesinin başarıyla tamamlanması.",
    type: "transport",
    badge: "Tur Sonu",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    location: "Okul Bahçesi",
    icon: "🏁"
  }
];

export const AYVALIK_CLOTHING_GUIDE = [
 {dayNum:1,title:'Atölyeler ve Cunda',emoji:'🎒',text:'Uzun etkinlik günü için rahat ayakkabı, katmanlı giyim ve yedek üst hazırla.',essentials:['Rahat spor ayakkabı','Yedek çorap ve tişört','Hafif yağmurluk']},
 {dayNum:2,title:'Küçükköy ve Şeytan Sofrası',emoji:'🧥',text:'Açık hava yürüyüşü için rüzgarlık ve kolay çıkarılabilen katmanlar tercih et.',essentials:['Rüzgarlık','Polar / sweatshirt','Su matarası']},
 {dayNum:3,title:'Hasat ve dönüş yolculuğu',emoji:'🫒',text:'Arazi çalışmasına uygun ayakkabı ile dönüş için temiz yedek kıyafetini ayrı tut.',essentials:['Araziye uygun ayakkabı','Rahat pantolon','Dönüş için yedek kıyafet']},
];

// Interactive Packing Checklist items from brochure recommendations
export const DEFAULT_PACKING_ITEMS = [
  { id: "id_card", label: "T.C. Kimlik Kartı / Nüfus Cüzdanı", category: "Zorunlu", note: "Kimlik kontrolleri için kolay ulaşabileceğin yerde bulundur", required: true },
  { id: "personal_headphones", label: "Kişisel Kablolu/Kablosuz Kulaklık", category: "Zorunlu", note: "Yolculukta kişisel dinleme için", required: true },
  { id: "raincoat", label: "Kapüşonlu Yağmurluk / Rüzgarlık Mont", category: "Giyim", note: "Açık hava etkinliklerinde hava değişimine hazırlık için", required: true },
  { id: "boots", label: "Dayanıklı Spor Ayakkabı ve Su Geçirmez Bot", category: "Giyim", note: "Hasat ve arazi çalışmalarında zemine uygun ayakkabı seç", required: true },
  { id: "spare_clothes", label: "Yedek Çorap, Tişört ve Rahat Pantolon", category: "Giyim", note: "Saha spor atölyeleri ve hasat sonrası değişim için", required: true },
  { id: "fleece", label: "Kalın Polar / Sweatshirt / Bere", category: "Giyim", note: "Şeytan Sofrası yüksek tepesi oldukça soğuk ve rüzgarlıdır", required: true },
  { id: "powerbank", label: "Powerbank (Taşınabilir Şarj Cihazı)", category: "Elektronik", note: "Otobüste priz vardır ancak arazi için tavsiye edilir", required: false },
  { id: "chargers", label: "Telefon & Tablet Şarj Kabloları", category: "Elektronik", note: "Otel ve otobüs kullanımı için", required: true },
  { id: "medicines", label: "Kişisel İlaçlar & Düzenli Vitaminler", category: "Sağlık", note: "Rehber öğretmene bilgi verilmelidir", required: false },
  { id: "notebook", label: "CAS Not Defteri ve Tükenmez Kalem", category: "Akademik", note: "Reflection toplantıları ve saha gözlemleri için", required: true },
  { id: "water_bottle", label: "Yeniden Doldurulabilir Su Matarası", category: "Kişisel", note: "Sürdürülebilirlik ve atölye süreçleri için", required: false },
  { id: "return_clothes", label: "Dönüş Yolculuğu İçin Temiz Yedek Kıyafet", category: "Giyim", note: "Hasattan sonra otobüste rahat etmek için", required: false }
];

export default function AyvalikCasPanel(props:AyvalikCasPanelProps){return <AyvalikCasContent key={props.currentUserId} {...props}/>;}

function AyvalikCasContent({
  socket,
  currentUserId,
  currentUsername,
  avatar,
  color,
  currentUserRoles = [],
  isEmirgan = false,
  onBackToMain
}: AyvalikCasPanelProps) {
  // Tabs: 'schedule' | 'weather' | 'chat' | 'gallery' | 'checklist' | 'reflections' | 'guide'
  const [sectionParams,setSectionParams]=useSearchParams();
  const section=sectionParams.get('section');
  const activeTab=AYVALIK_SECTIONS.some(s=>s.id===section)?(section||'home'):'home';
  const setActiveTab=(tab:string)=>{const next=new URLSearchParams(sectionParams);if(tab==='home')next.delete('section');else next.set('section',tab);setSectionParams(next,{replace:activeTab!=='home'});};
  const [notice,setNotice]=useState('');
  const [now,setNow]=useState(Date.now());
  const [packingQuery,setPackingQuery]=useState(''),[onlyMissing,setOnlyMissing]=useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | "all">("all");

  // 1. LIVE COUNTDOWN TO TRIP (25 Kasım 2026, 06:00)
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; isPassed: boolean }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPassed: false
  });

  useEffect(() => {
    const tripStart = new Date("2026-11-25T06:00:00+03:00").getTime();
    const updateCountdown = () => {
      const now = Date.now();
      setNow(now);
      const diff = tripStart - now;
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ days, hours, minutes, seconds, isPassed: false });
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. CHECKED ACTIVITIES (Interactive Schedule Completion)
  const [completedActivities, setCompletedActivities] = useState<string[]>(() => {
    return [...new Set(readStringList(`ayvalik_completed_act_${currentUserId}`).flatMap(value=>AYVALIK_PROGRAM.filter(a=>activityId(a)===value||a.title===value).map(activityId)))];
  });

  const toggleActivityCompletion = (actTitle: string) => {
    setCompletedActivities(prev => {
      const next = prev.includes(actTitle) ? prev.filter(t => t !== actTitle) : [...prev, actTitle];
      try {
        localStorage.setItem(`ayvalik_completed_act_${currentUserId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // 3. PACKING CHECKLIST STATE
  const {checked:checkedItems,toggle:toggleChecklistItem,loading:packingLoading,status:packingStatus}=usePackingList(currentUserId,DEFAULT_PACKING_ITEMS.map(i=>i.id));

  // 4. LIVE AYVALIK CAS CHAT STATE
  const [messages, setMessages] = useState<CasMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const fetchMessages = () => {
    fetch(getApiUrl("/api/ayvalik/messages"),{headers:getAuthHeaders()})
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchMessages();
    if (!socket) return;
    const handleNewMessage = (msg: CasMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    socket.on("ayvalik:new_message", handleNewMessage);
    return () => {
      socket.off("ayvalik:new_message", handleNewMessage);
    };
  }, [socket]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    if (!token) {
      alert("Mesaj yazmak için giriş yapmalısınız.");
      return;
    }

    const text = chatInput.trim();
    setChatLoading(true);

    try {
      const res = await fetch(getApiUrl("/api/ayvalik/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error||"Mesaj gönderilemedi.");
      } else { setChatInput(""); fetchMessages(); }
    } catch (err) {
      setNotice("Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    if (!token) return;

    setIsSendingMedia(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch(getApiUrl("/api/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok||!uploadData.url) throw Error(uploadData.error||"Dosya yüklenemedi.");
      if (uploadData.url) {
        const isVid = file.type.startsWith("video/");
        const messageRes=await fetch(getApiUrl("/api/ayvalik/messages"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            content: isVid ? "🎥 Video Paylaştı" : "📷 Fotoğraf Paylaştı",
            media_url: uploadData.url,
            media_type: isVid ? "video" : "image"
          })
        });
        const result=await messageRes.json();if(!messageRes.ok||!result.success)throw Error(result.error||"Medya mesajı gönderilemedi.");fetchMessages();
      }
    } catch (err) {
      console.error("Media upload error:", err);
      alert("Dosya yüklenirken hata oluştu.");
    } finally {
      setIsSendingMedia(false);
      e.target.value = "";
    }
  };

  // 5. AYVALIK CAS PHOTO & VIDEO GALLERY STATE
  const [galleryItems, setGalleryItems] = useState<CasGalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryDayFilter, setGalleryDayFilter] = useState<string>("all");
  const [selectedLightboxItem, setSelectedLightboxItem] = useState<CasGalleryItem | null>(null);
  const openGalleryItem=(item:CasGalleryItem)=>{setNotice('');setSelectedLightboxItem(item);};
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadDayTag, setUploadDayTag] = useState("1. Gün - Saha Çalışması & Cunda");
  const [uploadLocationTag, setUploadLocationTag] = useState("Cunda Adası");
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const galleryRequest=useRef(0);
  const fetchGallery = () => {
    const request=++galleryRequest.current;
    setGalleryLoading(true);
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(getApiUrl(`/api/ayvalik/gallery?day=${encodeURIComponent(galleryDayFilter)}`), { headers })
      .then(res => res.json())
      .then(data => {
        if (request===galleryRequest.current && data && Array.isArray(data.items)) {
          setGalleryItems(data.items);
        }
      })
      .catch(() => {})
      .finally(() => {if(request===galleryRequest.current)setGalleryLoading(false);});
  };

  useEffect(() => {
    fetchGallery();
    if (!socket) return;
    const handleNewGallery = (item: CasGalleryItem) => {
      if(galleryDayFilter==='all'||item.day_tag===galleryDayFilter)setGalleryItems(prev => [item, ...prev.filter(i => i.id !== item.id)]);
    };
    const handleLiked = ({ id, likes_count }: { id: number; likes_count: number }) => {
      setGalleryItems(prev => prev.map(item => item.id === id ? { ...item, likes_count } : item));
      setSelectedLightboxItem(prev=>prev?.id===id?{...prev,likes_count}:prev);
    };
    const handleDeleted = ({ id }: { id: number }) => {
      setGalleryItems(prev => prev.filter(i => i.id !== id));
      setSelectedLightboxItem(prev=>prev?.id===id?null:prev);
    };

    socket.on("ayvalik:new_gallery_item", handleNewGallery);
    socket.on("ayvalik:gallery_liked", handleLiked);
    socket.on("ayvalik:gallery_deleted", handleDeleted);
    return () => {
      socket.off("ayvalik:new_gallery_item", handleNewGallery);
      socket.off("ayvalik:gallery_liked", handleLiked);
      socket.off("ayvalik:gallery_deleted", handleDeleted);
    };
  }, [socket, galleryDayFilter]);

  const handleLikeGalleryItem = async (itemId: number) => {
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    if (!token) {
      alert("Beğenmek için giriş yapmalısınız.");
      return;
    }

    try {
      const res = await fetch(getApiUrl(`/api/ayvalik/gallery/${itemId}/like`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok||!data.success){setNotice(data.error||'İşlem tamamlanamadı.');return;}
      if (data.success) {
        setGalleryItems(prev => prev.map(item => {
          if (item.id === itemId) {
            return { ...item, is_liked: data.liked, likes_count: data.likes_count };
          }
          return item;
        }));
        setSelectedLightboxItem(prev=>prev?.id===itemId?{...prev,is_liked:data.liked,likes_count:data.likes_count}:prev);
      }
    } catch {setNotice("Beğeni kaydedilemedi. Tekrar deneyebilirsin.");}
  };

  const handleDeleteGalleryItem = async (itemId: number) => {
    if (!confirm("Bu gezi medyasını silmek istediğinizden emin misiniz?")) return;
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    if (!token) return;

    try {
      const res = await fetch(getApiUrl(`/api/ayvalik/gallery/${itemId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok||!data.success){setNotice(data.error||'İşlem tamamlanamadı.');return;}
      if (data.success) {
        setGalleryItems(prev => prev.filter(item => item.id !== itemId));
        setSelectedLightboxItem(prev=>prev?.id===itemId?null:prev);
      }
    } catch {setNotice('Paylaşım silinemedi. Bağlantını kontrol edip tekrar dene.');}
  };

  const handleUploadGalleryFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) {
      alert("Lütfen en az bir fotoğraf veya video seçin.");
      return;
    }
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    if (!token) return;

    setNotice('');setIsUploadingFiles(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(getApiUrl("/api/upload"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok||!uploadData.url) throw Error(uploadData.error||"Dosya yüklenemedi.");
        if (uploadData.url) {
          const isVid = file.type.startsWith("video/") || file.name.endsWith(".mp4") || file.name.endsWith(".mov");
          const galleryRes=await fetch(getApiUrl("/api/ayvalik/gallery"), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              media_url: uploadData.url,
              media_type: isVid ? "video" : "image",
              caption: uploadCaption,
              day_tag: uploadDayTag,
              location_tag: uploadLocationTag
            })
          });
          const saved=await galleryRes.json();if(!galleryRes.ok||!saved.success)throw Error(saved.error||"Galeri kaydı oluşturulamadı.");
          setSelectedFiles(selectedFiles.slice(i+1));
        }
      }
      setShowUploadModal(false);
      setSelectedFiles(null);
      setUploadCaption("");
      fetchGallery();
    } catch (err) {
      console.error("Gallery upload error:", err);
      setNotice("Bazı dosyalar yüklenemedi. Başarıyla kaydedilenler galeride; kalan dosyalarla tekrar deneyebilirsin.");fetchGallery();
    } finally {
      setIsUploadingFiles(false);
    }
  };

  // 6. CAS REFLECTIONS (KAZANIM GÜNLÜĞÜ) STATE
  const [reflections, setReflections] = useState<CasReflection[]>([]);
  const [reflectionDay, setReflectionDay] = useState<number>(()=>readReflectionDraft(currentUserId).day);
  const [learningOutcome, setLearningOutcome] = useState(()=>readReflectionDraft(currentUserId).outcome);
  const [reflectionText, setReflectionText] = useState(()=>readReflectionDraft(currentUserId).text);
  useEffect(()=>{try{localStorage.setItem(`ayvalik_reflection_draft_${currentUserId}`,JSON.stringify({text:reflectionText,day:reflectionDay,outcome:learningOutcome}));}catch{setNotice("Tarayıcı taslağı saklayamadı. Sayfadan ayrılmadan günlüğünü kaydet.");}},[reflectionText,reflectionDay,learningOutcome,currentUserId]);
  const [reflectionSubmitting, setReflectionSubmitting] = useState(false);

  const fetchReflections = () => {
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    if (!token) return;
    fetch(getApiUrl("/api/ayvalik/reflections"), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.reflections)) {
          setReflections(data.reflections);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchReflections();
  }, []);

  const handleSaveReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionText.trim()) return;
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    if (!token) return;

    setNotice('');setReflectionSubmitting(true);
    try {
      const res = await fetch(getApiUrl("/api/ayvalik/reflections"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          day_number: reflectionDay,
          learning_outcome: learningOutcome,
          reflection_text: reflectionText.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReflectionText("");
        fetchReflections();
      } else setNotice(data.error||"Günlük kaydedilemedi; taslağın bu cihazda duruyor.");
    } catch (err) {
      setNotice("Günlük kaydedilemedi; bağlantını kontrol et. Taslağın bu cihazda duruyor.");
    } finally {
      setReflectionSubmitting(false);
    }
  };

  const dialogRef=useRef<HTMLDivElement>(null),dialogBusy=useRef(false);dialogBusy.current=isUploadingFiles;
  const dialogOpen=showUploadModal||!!selectedLightboxItem;
  useEffect(()=>{if(!dialogOpen)return;const previous=document.activeElement;const timer=setTimeout(()=>dialogRef.current?.querySelector<HTMLElement>('button,input,select,textarea,a[href]')?.focus(),0);const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!dialogBusy.current){e.preventDefault();setShowUploadModal(false);setSelectedLightboxItem(null);}if(e.key==='Tab'){const focusable=[...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')||[])];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',keys);return()=>{clearTimeout(timer);document.removeEventListener('keydown',keys);if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[dialogOpen]);

  // Filtered Program Schedule
  const filteredSchedule = useMemo(() => {
    if (selectedDayFilter === "all") return AYVALIK_PROGRAM;
    return AYVALIK_PROGRAM.filter(item => item.day === selectedDayFilter);
  }, [selectedDayFilter]);

  const pdfBrochureUrl = "/assets/aistudio/AYVALIK_CAS_PROJES__261105_100129_95e2bfcf.pdf";

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors overflow-y-auto overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* 1. HERO BANNER: AYVALIK CAS 2026 GEZİ MERKEZİ & GERİ SAYIM               */}
      {/* ========================================================================= */}
      <div className="relative shrink-0 min-w-0 bg-gradient-to-br from-teal-700 via-emerald-800 to-slate-950 text-white p-4 sm:p-8 md:p-10 shadow-2xl border-b border-emerald-500/20">
        {/* Decorative Ege Deniz ve Doğa Işıltıları */}
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] items-center gap-4 sm:gap-6">
          
          <div className="min-w-0 space-y-3">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black tracking-wider uppercase text-emerald-100 flex items-center gap-1.5 border border-white/20">
                <Sparkles size={14} className="text-amber-300" />
                <span>25 - 27 KASIM 2026 • 2 GECE 3 GÜN</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black tracking-wider uppercase shadow-md hidden sm:flex items-center gap-1">
                <span>🏨 4* BACACAN OTEL AYVALIK</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-teal-500/30 text-teal-200 text-xs font-semibold hidden sm:inline-block backdrop-blur-md border border-teal-400/30">
                Fora Turizm (TÜRSAB & IATA)
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Ayvalık CAS Projesi Gezi Paneli</span>
              <span className="text-3xl sm:text-4xl">🫒</span>
            </h1>

            <p className="hidden sm:block text-sm sm:text-base text-emerald-100 max-w-2xl leading-relaxed font-medium">
              Creativity, Action ve Service alanlarında kardeş okul atölyeleri, Sabancı Üniversitesi Küçükköy Teknoloji Merkezi, Şeytan Sofrası ve Kürşat Ayvalık zeytin hasadı ile dopdolu 3 günlük gezi rehberiniz.
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={pdfBrochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-2xl bg-white text-slate-900 hover:bg-emerald-50 font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-black/20 hover:scale-105 cursor-pointer"
              >
                <FileText size={16} className="text-emerald-700" />
                <span>Resmi PDF Broşürünü Aç</span>
                <ExternalLink size={14} className="text-slate-400" />
              </a>

              {onBackToMain && (
                <button
                  onClick={()=>activeTab==='home'?onBackToMain():setActiveTab('home')}
                  className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  <span>{activeTab==='home'?'Ana Sayfaya Dön':'Ayvalık Ana Sayfasına Dön'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Side: LIVE COUNTDOWN TO TRIP */}
          <div className="shrink-0 p-5 sm:p-6 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/20 shadow-2xl space-y-3 min-w-0 w-full">
            <div className="flex flex-wrap gap-2 items-center justify-between text-xs font-bold text-emerald-200 border-b border-white/15 pb-2">
              <span className="flex items-center gap-1.5">
                <Clock size={15} className="text-amber-400 animate-pulse" />
                <span>Gezi Başlangıcına Kalan Süre</span>
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-black">25 KASIM 06:00</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-white/10 border border-white/10">
                <span className="text-2xl sm:text-3xl font-black font-mono block text-white">{countdown.days}</span>
                <span className="text-[10px] font-bold uppercase text-emerald-300">GÜN</span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-white/10 border border-white/10">
                <span className="text-2xl sm:text-3xl font-black font-mono block text-amber-300">{countdown.hours}</span>
                <span className="text-[10px] font-bold uppercase text-emerald-300">SAAT</span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-white/10 border border-white/10">
                <span className="text-2xl sm:text-3xl font-black font-mono block text-white">{countdown.minutes}</span>
                <span className="text-[10px] font-bold uppercase text-emerald-300">DAKİKA</span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-white/10 border border-white/10">
                <span className="text-2xl sm:text-3xl font-black font-mono block text-emerald-400">{countdown.seconds}</span>
                <span className="text-[10px] font-bold uppercase text-emerald-300">SANİYE</span>
              </div>
            </div>

            <div className="text-[11px] text-emerald-200/90 text-center font-medium bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20">
              📍 Buluşma: <strong>25 Kasım 05:45</strong> Okul Bahçesi (Otobüs kalkışı: 06:00)
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ANA PANEL SEKMELERİ (HORIZONTAL TAB BAR)                              */}
      {/* ========================================================================= */}
      {activeTab!=='home'&&<nav className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"><div className="max-w-7xl mx-auto p-4 flex flex-wrap gap-3 items-center"><button onClick={()=>setActiveTab('home')} className="font-bold text-emerald-600 flex gap-2 items-center"><ArrowLeft size={18}/>Ayvalık ana sayfası</button><select aria-label="Gezi bölümü" className="min-w-0 p-2 rounded-xl bg-slate-100 dark:bg-slate-800" value={activeTab} onChange={e=>setActiveTab(e.target.value as any)}>{AYVALIK_SECTIONS.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></div></nav>}

      {/* ========================================================================= */}
      {/* 3. AKTİF SEKME İÇERİĞİ                                                    */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {notice&&!showUploadModal&&!selectedLightboxItem&&<div role="alert" className="rounded-2xl p-4 border border-amber-400 bg-amber-50 dark:bg-amber-950 flex gap-3"><p className="flex-1">{notice}</p><button aria-label="Bildirimi kapat" onClick={()=>setNotice('')}>×</button></div>}
        {activeTab==='home'&&<section aria-label="Ayvalık bölümleri" className="space-y-5"><div><h2 className="text-2xl font-black">Gezini planla, arkadaşlarınla hazırlan</h2><p className="text-slate-500 mt-2">Gitmek istediğin bölümü seç.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">{AYVALIK_SECTIONS.map((section)=>{const Icon=section.icon;return <button key={section.id} onClick={()=>setActiveTab(section.id)} className="group min-w-0 text-left p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-500 transition-all"><span className="inline-flex p-4 rounded-2xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 mb-5"><Icon size={28}/></span><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-black">{section.title}</h3><ChevronRight className="shrink-0 text-emerald-500"/></div><p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{section.description}</p></button>;})}</div></section>}
        <AyvalikRooms currentUserId={currentUserId} socket={socket} active={activeTab==='rooms'} onOpen={()=>setActiveTab('rooms')}/>


        {/* ----------------------------------------------------------------------- */}
        {/* SEKME 1: GEZİ AJANDASI VE DETAYLI SAAT SAAT PROGRAM                      */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "schedule" && (
          <div className="space-y-6 animate-fade-in">
            <button className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold" onClick={()=>downloadText('ayvalik-cas-2026.ics',programCalendar(AYVALIK_PROGRAM),'text/calendar;charset=utf-8')}>Programı takvimime ekle</button>
            {/* Header & Day Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="text-emerald-600" size={24} />
                  <span>3 Günlük Gezi Programı</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tamamladığınız etkinlikleri yanlarındaki daireye tıklayarak işaretleyebilirsiniz ({completedActivities.length}/{AYVALIK_PROGRAM.length} tamamlandı).
                </p>
              </div>

              {/* Day Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: "all", label: "Tüm Program" },
                  { id: 1, label: "1. Gün (25 Kasım)" },
                  { id: 2, label: "2. Gün (26 Kasım)" },
                  { id: 3, label: "3. Gün (27 Kasım)" },
                ].map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDayFilter(d.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedDayFilter === d.id
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Stream */}
            <div className="space-y-4">
              {filteredSchedule.map((item, idx) => {
                const isCompleted = completedActivities.includes(activityId(item));
                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-3xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-sm ${
                      isCompleted
                        ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30 opacity-80"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button
                        aria-label={`${item.day}. gün ${item.time} ${item.title}`} aria-pressed={isCompleted}
                        onClick={() => toggleActivityCompletion(activityId(item))}
                        className="mt-1 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer shrink-0"
                        title={isCompleted ? "Tamamlanmadı olarak işaretle" : "Tamamlandı olarak işaretle"}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={24} className="text-emerald-500 fill-emerald-500/20" />
                        ) : (
                          <Circle size={24} />
                        )}
                      </button>

                      {/* Icon */}
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-2xl flex items-center justify-center shrink-0 shadow-xs">
                        {item.icon}
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            ⏱️ {item.time}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">
                            {item.dateText}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        </div>

                        <h3 className={`text-base sm:text-lg font-black text-slate-900 dark:text-white ${isCompleted ? "line-through text-slate-400 dark:text-slate-500" : ""}`}>
                          {item.title}
                        </h3>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                            <MapPin size={13} className="text-rose-500" />
                            <span>{item.location}</span>
                          </span>

                          {item.sdg && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md">
                              🌐 {item.sdg}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="self-end md:self-center shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {item.day}. GÜN
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* SEKME 2: 25-27 KASIM AYVALIK HAVA TAHMİNİ VE DETAYLI GİYİM UYARILARI      */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'weather' && <div className="space-y-6 animate-fade-in"><AyvalikWeather/></div>}

        {activeTab === "chat" && (
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[650px] overflow-hidden animate-fade-in">
            {/* Chat Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-500/20">
                  💬
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Ayvalık CAS Gezi Sohbet Odası</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Öğretmenler, rehberler ve geziye katılan tüm öğrenciler için anlık iletişim kanalı
                  </p>
                </div>
              </div>

              <button
                onClick={fetchMessages}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                title="Yenile"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Quick Announcement Broadcast Bar */}
            <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold overflow-x-auto no-scrollbar">
              <Megaphone size={14} className="shrink-0 text-emerald-600" />
              <span>Duyuru Kısayolları:</span>
              <button
                onClick={() => setChatInput("🚌 Otobüs kalkışına 10 dakika kaldı, lütfen toplanma noktasına gelin!")}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-emerald-100 text-[11px] font-semibold border border-emerald-500/30 whitespace-nowrap cursor-pointer"
              >
                "10 Dk Kaldı"
              </button>
              <button
                onClick={() => setChatInput("🏨 Buluşma noktamız: Otel Lobisi")}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-emerald-100 text-[11px] font-semibold border border-emerald-500/30 whitespace-nowrap cursor-pointer"
              >
                "Otel Lobisi"
              </button>
              <button
                onClick={() => setChatInput("🫒 Zeytin hasadı atölyesi için toplanıyoruz!")}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-emerald-100 text-[11px] font-semibold border border-emerald-500/30 whitespace-nowrap cursor-pointer"
              >
                "Hasat Zamanı"
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-2xl">
                    💬
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Henüz Mesaj Yok</h4>
                  <p className="text-xs max-w-sm">
                    Ayvalık CAS Gezi Sohbet Odası'na ilk mesajı sen yazarak arkadaşlarınla ve öğretmenlerinle iletişime geçebilirsin!
                  </p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <Avatar
                        url={msg.avatar}
                        name={msg.username}
                        color={msg.color}
                        size={8}
                        className="w-8 h-8 rounded-full shrink-0"
                      />

                      <div className={`max-w-[78%] sm:max-w-[65%] space-y-1 ${isMe ? "items-end text-right" : "items-start text-left"}`}>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {msg.username}
                          </span>
                          <span>
                            {casDateLabel(msg.created_at)}
                          </span>
                        </div>

                        <div
                          className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                            isMe
                              ? "bg-emerald-600 text-white rounded-tr-xs"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/60 dark:border-slate-700/60"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                          {msg.media_url && (
                            <div className="mt-2 rounded-xl overflow-hidden max-h-60 bg-black/20">
                              {msg.media_type === "video" ? (
                                <video src={msg.media_url} controls className="w-full max-h-60 object-contain rounded-xl" />
                              ) : (
                                <img src={msg.media_url} alt="Paylaşılan medya" className="w-full max-h-60 object-cover rounded-xl" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-2">
              <label className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors shrink-0" title="Fotoğraf veya Video Ekle">
                <Image size={18} />
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleChatFileUpload}
                  className="hidden"
                  disabled={isSendingMedia}
                />
              </label>

              <input
                type="text"
                maxLength={4000} value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={isSendingMedia ? "Medya yükleniyor..." : "Ayvalık CAS sohbetine mesaj yaz..."}
                disabled={chatLoading || isSendingMedia}
                className="min-w-0 flex-1 py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <button
                type="submit"
                aria-label="Mesaj gönder"
                disabled={chatLoading || !chatInput.trim() || isSendingMedia}
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20 shrink-0"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* SEKME 4: AYVALIK CAS MEDYA GALERİSİ (SADECE GEZİ FOTO & VİDEOLARI)        */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "gallery" && (
          <div className="space-y-6 animate-fade-in">
            {/* Gallery Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Image className="text-emerald-600" size={24} />
                  <span>Ayvalık CAS Gezi Medya Galerisi</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sadece Ayvalık CAS gezisinde çekilen anılar, saha çalışmaları ve atölye fotoğrafları/videoları
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Day Filter */}
                <select
                  value={galleryDayFilter}
                  onChange={e => setGalleryDayFilter(e.target.value)}
                  className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">Tüm Günler</option>
                  <option value="1. Gün - Saha Çalışması & Cunda">1. Gün (Saha & Cunda)</option>
                  <option value="2. Gün - Küçükköy & Şeytan Sofrası">2. Gün (Küçükköy & Şeytan Sofrası)</option>
                  <option value="3. Gün - Zeytin Hasadı & Dönüş">3. Gün (Zeytin Hasadı & Müze)</option>
                  <option value="Genel / Yolculuk">Genel / Yolculuk</option>
                </select>

                <button
                  onClick={() => {setNotice('');setShowUploadModal(true);}}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                >
                  <Plus size={16} />
                  <span>Gezi Medyası Yükle</span>
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            {galleryLoading ? (
              <div className="p-16 text-center text-slate-400 text-sm">
                Fotoğraflar ve videolar yükleniyor...
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="p-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
                  📸
                </div>
                <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">Henüz Medya Yüklenmedi</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Gezide çektiğin fotoğrafları ve videoları yükleyerek sınıf arkadaşlarınla ortak hafızada toplayabilirsin!
                </p>
                <button
                  onClick={() => {setNotice('');setShowUploadModal(true);}}
                  className="mt-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-md cursor-pointer hover:bg-emerald-500 transition-all"
                >
                  + İlk Fotoğrafı Sen Yükle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {galleryItems.map(item => (
                  <div
                    key={item.id} role="button" aria-label={item.caption||'Gezi anısını aç'} tabIndex={0}
                    onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openGalleryItem(item);}}}
                    onClick={() => openGalleryItem(item)}
                    className="group relative rounded-2xl overflow-hidden bg-slate-900 aspect-square cursor-pointer shadow-sm hover:shadow-xl transition-all border border-slate-200 dark:border-slate-800 hover:scale-[1.02]"
                  >
                    {item.media_type === "video" ? (
                      <div className="w-full h-full relative flex items-center justify-center bg-black">
                        <video src={item.media_url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="w-10 h-10 rounded-full bg-white/80 text-slate-950 flex items-center justify-center shadow-lg font-bold">
                            ▶
                          </span>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={item.media_url}
                        alt={item.caption || "Ayvalık CAS"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    )}

                    {/* Gradient Overlay & Badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md">
                          {item.day_tag?.split("-")[0] || "Gezi"}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-bold bg-black/60 px-2 py-0.5 rounded-full">
                          <Heart size={12} className={item.is_liked ? "text-rose-500 fill-rose-500" : "text-white"} />
                          <span>{item.likes_count}</span>
                        </div>
                      </div>

                      <div>
                        {item.caption && (
                          <p className="text-xs font-semibold line-clamp-1">{item.caption}</p>
                        )}
                        <span className="text-[10px] text-slate-300 block">
                          Yükleyen: {item.username}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* SEKME 5: BAVUL & SEYAHAT ÇANTASI KONTROL LİSTESİ (CHECKLIST)             */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "checklist" && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Backpack className="text-emerald-600" size={24} />
                  <span>Ayvalık Seyahat & Çanta Hazırlık Listesi</span>
                </h2>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                  {checkedItems.length} / {DEFAULT_PACKING_ITEMS.length} Hazır
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gezi için hazırlık rehberi. Hazırladığın eşyaları kendin işaretle; öğretmeninin güncel listesini de kontrol et.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-center"><input aria-label="Çanta listesinde ara" placeholder="Eşya veya kategori ara" value={packingQuery} onChange={e=>setPackingQuery(e.target.value)} className="min-w-0 flex-1 p-3 rounded-xl border bg-white dark:bg-slate-900"/><button aria-pressed={onlyMissing} onClick={()=>setOnlyMissing(v=>!v)} className="p-3 rounded-xl border font-bold">{onlyMissing?'Tüm eşyaları göster':'Yalnızca eksikler'}</button></div>
            <p role="status" className="text-sm text-slate-500">{packingLoading?'Liste yükleniyor…':packingStatus||'Seçimlerin hesabına kaydedilir.'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEFAULT_PACKING_ITEMS.filter(i=>(!onlyMissing||!checkedItems.includes(i.id))&&(i.label+' '+i.category).toLocaleLowerCase('tr').includes(packingQuery.toLocaleLowerCase('tr'))).map(item => {
                const isChecked = checkedItems.includes(item.id);
                return (
                  <div
                    key={item.id} role="checkbox" aria-label={item.label} aria-checked={isChecked} aria-disabled={packingLoading} tabIndex={0}
                    onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();toggleChecklistItem(item.id);}}}
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex items-start gap-4 select-none ${
                      isChecked
                        ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/40 opacity-80"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm"
                    }`}
                  >
                    <span aria-hidden="true" className="mt-0.5 text-slate-400 shrink-0">
                      {isChecked ? (
                        <CheckCircle2 size={22} className="text-emerald-500 fill-emerald-500/20" />
                      ) : (
                        <Circle size={22} />
                      )}
                    </span>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm sm:text-base font-bold ${isChecked ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>
                          {item.label}
                        </span>
                        {item.required && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase">
                            Zorunlu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.note}
                      </p>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">
                      {item.category}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* SEKME 6: CAS KAZANIM VE DEĞERLENDİRME GÜNLÜĞÜ (REFLECTIONS)              */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "reflections" && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex flex-wrap min-w-0 items-center gap-2">
                <BookOpen className="text-emerald-600" size={24} />
                <span>CAS Değerlendirme & Kazanım Günlüğü (Reflection)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Her gün akşamı yapılacak 'CAS Team Reflection' toplantısı için kendi kişisel gözlemlerinizi, edindiğiniz becerileri ve topluma katkılarınızı buraya kaydedin.
              </p>
            </div>

            {/* Reflection Note Input Form */}
            <form onSubmit={handleSaveReflection} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Yeni Reflection / Günlük Notu Ekle
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Gezi Günü
                  </label>
                  <select
                    value={reflectionDay}
                    onChange={e => setReflectionDay(Number(e.target.value))}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value={1}>1. Gün: Kardeş Okul Atölyeleri & Cunda</option>
                    <option value={2}>2. Gün: Sabancı Üni Küçükköy & Şeytan Sofrası</option>
                    <option value={3}>3. Gün: Zeytin Hasadı & Zeytinyağı Müzesi</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Kazanım Alanı (CAS Learning Outcome)
                  </label>
                  <select
                    value={learningOutcome}
                    onChange={e => setLearningOutcome(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="SERVICE - Toplum Hizmeti & Empati">SERVICE - Toplum Hizmeti & Empati</option>
                    <option value="CREATIVITY - Yaratıcı Problem Çözme & Sanat">CREATIVITY - Yaratıcı Problem Çözme & Sanat</option>
                    <option value="ACTION - Fiziksel Aktivite & Saha Çalışması">ACTION - Fiziksel Aktivite & Saha Çalışması</option>
                    <option value="GLOBAL ENGAGEMENT - Sürdürülebilirlik & Çevre">GLOBAL ENGAGEMENT - Sürdürülebilirlik & Çevre</option>
                    <option value="COLLABORATION - Takım Çalışması & İletişim">COLLABORATION - Takım Çalışması & İletişim</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Kişisel Değerlendirmeniz & Öğrendikleriniz (Reflection Text)
                </label>
                <textarea
                  aria-label="CAS günlük taslağı"
                  maxLength={12000} value={reflectionText}
                  onChange={e => setReflectionText(e.target.value)}
                  placeholder="Bugün kardeş okuldaki öğrencilerle nasıl bağ kurdunuz? Karşılaştığınız zorluklar nelerdi? Bu deneyim size ne kattı?..."
                  rows={4}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={reflectionSubmitting || !reflectionText.trim()}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm cursor-pointer transition-all shadow-md shadow-emerald-600/20"
              >
                {reflectionSubmitting ? "Kaydediliyor..." : "Kazanım Notunu Kaydet"}
              </button>
            </form>

            <p className="text-xs text-slate-500">Taslağın bu hesap için bu cihazda otomatik saklanır. Paylaşmak için kaydet düğmesine bas.</p>
            <button disabled={!reflections.length} onClick={()=>downloadText('ayvalik-cas-gunlugum.txt',reflections.map(r=>`${r.day_number}. Gün · ${r.learning_outcome}\n${r.reflection_text}`).join('\n\n'))} className="p-3 rounded-xl border font-bold disabled:opacity-40">CAS günlüğümü indir</button>
            {/* Saved Reflections List */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                Kaydedilen Günlükler ({reflections.length})
              </h3>
              {reflections.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  Henüz reflection notu eklemediniz. Gezi sırasında her günün değerlendirmesini yukarıdaki formu kullanarak ekleyebilirsiniz.
                </div>
              ) : (
                reflections.map(ref => (
                  <div
                    key={ref.id}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
                  >
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <div className="flex flex-wrap min-w-0 items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs border border-emerald-500/20">
                          {ref.day_number}. GÜN
                        </span>
                        <span className="font-bold text-xs text-purple-600 dark:text-purple-400">
                          {ref.learning_outcome}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {casDateLabel(ref.created_at)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                      {ref.reflection_text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* SEKME 7: OTEL, ACENTE, ACİL İLETİŞİM & KURALLAR                           */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "guide" && (
          <div className="space-y-6 animate-fade-in">
            {/* Hotel Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase">
                  Konaklama Merkezi
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  4* Bacacan Otel Ayvalık
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                  Ayvalık merkezde yer alan 4 yıldızlı Bacacan Otel'de 2 gece oda + açık büfe kahvaltı konaklama yapılacaktır. Otelimizde Wi-Fi, toplantı salonu ve 24 saat resepsiyon mevcuttur.
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold pt-1">
                  <MapPin size={14} className="text-rose-500" />
                  <span>İsmetpaşa Mah. Atatürk Cad. No:165, Ayvalık / Balıkesir</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                <a
                  href="https://maps.google.com/?q=Bacacan+Hotel+Ayvalik"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <MapPin size={16} />
                  <span>Google Haritalarda Aç</span>
                </a>
              </div>
            </div>

            {/* Travel Agency & Official Services */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-500" />
                  <span>Tura Dahil Olan Hizmetler</span>
                </h4>
                <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">✓ Lüks Model D2/B2 Turizm Belgeli Otobüsle Seyahat</li>
                  <li className="flex items-center gap-2">✓ 4* Bacacan Otel'de 2 Gece Oda + Kahvaltı Konaklama</li>
                  <li className="flex items-center gap-2">✓ Gidiş Günü Araçta Kahvaltı Paketi İkramı</li>
                  <li className="flex items-center gap-2">✓ Tüm Misafirlerimize TÜRSAB Seyahat Sigortası</li>
                  <li className="flex items-center gap-2">✓ Profesyonel Kokartlı Rehberlik Hizmeti</li>
                  <li className="flex items-center gap-2">✓ Araç İçi İkramlar ve Fora Turizm Güvencesi</li>
                  <li className="flex items-center gap-2">✓ 2 Akşam Yemeği (Otel veya Restoranda)</li>
                </ul>
              </div>

              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-500" />
                  <span>Önemli Kurallar & Tavsiyeler</span>
                </h4>
                <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span><strong>Şahsi Kulaklık:</strong> Karayolları hijyen yönetmeliği gereği otobüste kulaklık dağıtılmamaktadır. Kendi kulaklığınızı yanınıza alınız.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span><strong>Emniyet Kemeri:</strong> Güvenlik nedeniyle seyahat süresince emniyet kemerlerinin takılması yasal zorunluluktur.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span><strong>Şarj ve Cihazlar:</strong> Otobüste priz ve şarj mevcuttur. Tablet ve telefon getirilebilir.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span><strong>Öğle Yemekleri:</strong> Öğle yemekleri ve kişisel ekstra harcamalar fiyata dahil değildir.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Emergency & Agency Contacts */}
            <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl space-y-3">
              <h4 className="font-extrabold text-sm text-emerald-300 uppercase tracking-wider">
                Fora Turizm & Organizasyon İletişim Bilgileri
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300 pt-1">
                <div>
                  <span className="text-slate-400 block">Acente Telefonu:</span>
                  <a href="tel:02163809125" className="font-mono font-bold text-white hover:underline">0216 380 91 25</a>
                </div>
                <div>
                  <span className="text-slate-400 block">E-Posta:</span>
                  <a href="mailto:info@foraturizm.com" className="font-mono font-bold text-white hover:underline">info@foraturizm.com</a>
                </div>
                <div>
                  <span className="text-slate-400 block">Merkez Adres:</span>
                  <span className="font-medium text-white">Bağdat Cad. Fora Apt. 528/3 Bostancı / Kadıköy / İstanbul</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS: GALLERY UPLOAD & LIGHTBOX VIEW                                 */}
      {/* ========================================================================= */}

      {/* Upload Media Modal */}
      {showUploadModal && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Gezi medyası yükle" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="w-full max-w-lg max-h-[calc(100dvh-32px)] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Image size={20} className="text-emerald-600" />
                <span>Ayvalık Gezi Medyası Yükle</span>
              </h3>
              <button
                aria-label="Yükleme penceresini kapat" disabled={isUploadingFiles}
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {notice&&<p role="alert" className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950 text-sm">{notice}</p>}
            <form onSubmit={handleUploadGalleryFiles} className="space-y-4"><fieldset disabled={isUploadingFiles} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Fotoğraf veya Video Seçin (Çoklu Seçim Desteklenir)
                </label>
                <input
                  type="file" aria-label="Gezi fotoğrafı veya videosu"
                  accept="image/*,video/*"
                  multiple
                  onChange={e => setSelectedFiles(Array.from(e.target.files||[]))}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Gezi Günü
                  </label>
                  <select
                    value={uploadDayTag}
                    onChange={e => setUploadDayTag(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white"
                  >
                    <option value="1. Gün - Saha Çalışması & Cunda">1. Gün (Saha & Cunda)</option>
                    <option value="2. Gün - Küçükköy & Şeytan Sofrası">2. Gün (Küçükköy & Şeytan Sofrası)</option>
                    <option value="3. Gün - Zeytin Hasadı & Dönüş">3. Gün (Zeytin Hasadı & Müze)</option>
                    <option value="Genel / Yolculuk">Genel / Yolculuk</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Konum
                  </label>
                  <select
                    value={uploadLocationTag}
                    onChange={e => setUploadLocationTag(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white"
                  >
                    <option value="Cunda Adası">Cunda Adası</option>
                    <option value="Şeytan Sofrası">Şeytan Sofrası</option>
                    <option value="Sabancı Üni Küçükköy">Küçükköy Teknoloji Atölyesi</option>
                    <option value="Anadolu Eserleri Müzesi">Anadolu Eserleri Müzesi</option>
                    <option value="Kürşat Zeytin Bahçesi">Kürşat Zeytinliği</option>
                    <option value="Bacacan Otel">4* Bacacan Otel</option>
                    <option value="Kardeş Okul Sahası">Kardeş Okul</option>
                    <option value="Otobüs & Yolculuk">Otobüs & Yolculuk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Açıklama / Başlık (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  maxLength={1000} value={uploadCaption}
                  onChange={e => setUploadCaption(e.target.value)}
                  placeholder="Örn: Cunda gün batımı veya Küçükköy robotik çalışması..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button" disabled={isUploadingFiles}
                onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingFiles || !selectedFiles || selectedFiles.length === 0}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  {isUploadingFiles ? "Yükleniyor..." : "Yükle"}
                </button>
              </div>
            </fieldset></form>
          </div>
        </div>
      )}

      {/* Lightbox Fullscreen Media Modal */}
      {selectedLightboxItem && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Gezi anısı" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in pointer-events-auto">
          <button
            aria-label="Fotoğrafı kapat"
            onClick={() => setSelectedLightboxItem(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-lg font-bold transition-all z-50 cursor-pointer"
          >
            ✕
          </button>

          <div className="max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center space-y-4">
            <div className="relative max-h-[75vh] w-full flex items-center justify-center overflow-hidden rounded-3xl bg-black">
              {selectedLightboxItem.media_type === "video" ? (
                <video src={selectedLightboxItem.media_url} controls autoPlay className="max-h-[60dvh] max-w-full rounded-2xl" />
              ) : (
                <img src={selectedLightboxItem.media_url} alt={selectedLightboxItem.caption || "Ayvalık CAS"} className="max-h-[60dvh] max-w-full object-contain rounded-2xl" />
              )}
            </div>

            {notice&&<p role="alert" className="w-full p-3 rounded-xl bg-amber-950 text-white">{notice}</p>}
            {/* Info Footer */}
            <div className="w-full max-h-[25dvh] overflow-y-auto flex flex-wrap gap-3 items-center justify-between text-white p-3 rounded-2xl bg-white/10 backdrop-blur-md">
              <div>
                <span className="font-bold text-sm block break-words">{selectedLightboxItem.caption || "Ayvalık CAS Gezi Anısı"}</span>
                <span className="text-xs text-slate-300">
                  {selectedLightboxItem.day_tag} • {selectedLightboxItem.location_tag} • Yükleyen: {selectedLightboxItem.username}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleLikeGalleryItem(selectedLightboxItem.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Heart size={14} className={selectedLightboxItem.is_liked ? "text-rose-500 fill-rose-500" : "text-white"} />
                  <span>{selectedLightboxItem.likes_count}</span>
                </button>

                <a
                  href={selectedLightboxItem.media_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title="İndir"
                >
                  <Download size={16} />
                </a>

                {(isEmirgan || selectedLightboxItem.user_id === currentUserId) && (
                  <button
                    onClick={() => handleDeleteGalleryItem(selectedLightboxItem.id)}
                    className="p-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                    title="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
