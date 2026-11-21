import { createHash } from "node:crypto";
import {
  isCefrLevel,
  studyLevels,
  type CefrLevel,
  type StoredCefrLevel,
} from "../../shared/germanActivities";
import { normalizeText, stripArticle } from "./cefr";
import type { PartOfSpeech } from "./curriculum";
import type { MasteryRecord, Vocabulary } from "./learning";

export interface CurriculumCategoryDef {
  id: string;
  order: number;
  titleTr: string;
  titleDe: string;
  icon: string;
  descriptionTr: string;
  objectivesTr: string[];
  levels: CefrLevel[];
  defaultSubtopicTr: string;
  defaultSubtopicDe: string;
}

export const GERMAN_CURRICULUM_CATEGORIES: CurriculumCategoryDef[] = [
  {
    id: "personal_intro",
    order: 1,
    titleTr: "Kişisel Bilgiler ve Tanışma",
    titleDe: "Persönliche Angaben & Begrüßung",
    icon: "hand-metal",
    descriptionTr: "Selamlaşma, vedalaşma, nezaket ifadeleri ve kendini tanıtma kalıpları.",
    objectivesTr: [
      "Günlük selamlaşma ve vedalaşma kalıplarını doğru telaffuzla kullanır.",
      "Kendini, memleketini ve temel iletişim ifadelerini kurar.",
    ],
    levels: ["A1", "A2"],
    defaultSubtopicTr: "Selamlaşma ve Nezaket",
    defaultSubtopicDe: "Begrüßung und Höflichkeit",
  },
  {
    id: "family_social",
    order: 2,
    titleTr: "Aile, Arkadaşlar ve İlişkiler",
    titleDe: "Familie, Freunde & Beziehungen",
    icon: "users",
    descriptionTr: "Aile bireyleri, arkadaşlık, davetler ve sosyal yaşam kelimeleri.",
    objectivesTr: [
      "Aile üyelerini ve yakın çevresini artikel ve çoğul halleriyle tanıtır.",
      "Davet, kutlama ve birlikte yapılan etkinlikleri ifade eder.",
    ],
    levels: ["A1", "A2", "B1"],
    defaultSubtopicTr: "Aile ve Yakın Çevre",
    defaultSubtopicDe: "Familie und soziales Umfeld",
  },
  {
    id: "home_housing",
    order: 3,
    titleTr: "Ev, Konut, Mobilya ve Eşyalar",
    titleDe: "Wohnen, Haus & Einrichtung",
    icon: "home",
    descriptionTr: "Ev bölümleri, mobilyalar, beyaz eşyalar, kiralama ve taşınma.",
    objectivesTr: [
      "Oda, mobilya ve ev eşyalarını artikelleriyle doğru adlandırır.",
      "Konut arama, daire özellikleri ve ev yaşamını anlatır.",
    ],
    levels: ["A1", "A2", "B1"],
    defaultSubtopicTr: "Ev ve Eşyalar",
    defaultSubtopicDe: "Haus, Möbel und Geräte",
  },
  {
    id: "food_restaurant",
    order: 4,
    titleTr: "Yiyecek, İçecek ve Restoran",
    titleDe: "Essen, Trinken & Restaurant",
    icon: "utensils",
    descriptionTr: "Temel gıdalar, içecekler, mutfak alışverişi ve restoranda sipariş.",
    objectivesTr: [
      "Yiyecek ve içecek isimlerini doğru artikel ve fiillerle kullanır.",
      "Restoranda sipariş verme ve hesap isteme cümleleri kurar.",
    ],
    levels: ["A1", "A2", "B1"],
    defaultSubtopicTr: "Yiyecek ve İçecekler",
    defaultSubtopicDe: "Lebensmittel und Getränke",
  },
  {
    id: "shopping_money",
    order: 5,
    titleTr: "Alışveriş, Giyim, Fiyatlar ve Para",
    titleDe: "Einkaufen, Kleidung & Preise",
    icon: "shopping-bag",
    descriptionTr: "Mağaza alışverişi, kıyafetler, fiyat karşılaştırma ve ödeme ifadeleri.",
    objectivesTr: [
      "Fiyat, ödeme, fatura ve alışveriş fiillerini günlük diyaloglarda kullanır.",
      "Kıyafet ve ürün özelliklerini sıfatlarla betimler.",
    ],
    levels: ["A1", "A2", "B1"],
    defaultSubtopicTr: "Alışveriş ve Ödeme",
    defaultSubtopicDe: "Einkauf und Bezahlung",
  },
  {
    id: "travel_transport",
    order: 6,
    titleTr: "Seyahat, Ulaşım ve Yönler",
    titleDe: "Reisen, Verkehr & Orientierung",
    icon: "train",
    descriptionTr: "Toplu taşıma, istasyon, bilet, tatil planlama ve şehir içi yön bulma.",
    objectivesTr: [
      "Ulaşım araçlarını, bilet ve istasyon kavramlarını cümle içinde kullanır.",
      "Yol sorma, seyahat ve tatil deneyimlerini anlatır.",
    ],
    levels: ["A1", "A2", "B1", "B2"],
    defaultSubtopicTr: "Ulaşım ve Seyahat",
    defaultSubtopicDe: "Verkehrsmittel und Reise",
  },
  {
    id: "time_routine",
    order: 7,
    titleTr: "Zaman, Tarih ve Günlük Rutin",
    titleDe: "Zeit, Kalender & Tagesablauf",
    icon: "clock",
    descriptionTr: "Günler, zaman zarfları, randevular ve sabahtan akşama günlük alışkanlıklar.",
    objectivesTr: [
      "Zaman ifadelerini Almanca cümle diziliminde doğru konumlandırır.",
      "Günlük rutin ve randevu cümlelerini ayrılabilen fiillerle kurar.",
    ],
    levels: ["A1", "A2", "B1"],
    defaultSubtopicTr: "Zaman ve Günlük Yaşam",
    defaultSubtopicDe: "Zeitangaben und Alltag",
  },
  {
    id: "education_learning",
    order: 8,
    titleTr: "Okul, Eğitim ve Öğrenme",
    titleDe: "Schule, Bildung & Lernen",
    icon: "graduation-cap",
    descriptionTr: "Okul yaşamı, dil öğrenimi, ders çalışma, sınavlar ve akademik gelişim.",
    objectivesTr: [
      "Okuma, yazma, öğrenme ve açıklama fiillerini doğru çekimler.",
      "Eğitim hedeflerini ve öğrenme yöntemlerini ifade eder.",
    ],
    levels: ["A1", "A2", "B1", "B2"],
    defaultSubtopicTr: "Eğitim ve Dil Öğrenimi",
    defaultSubtopicDe: "Schule und Spracherwerb",
  },
  {
    id: "work_career",
    order: 9,
    titleTr: "İş, Meslekler ve Çalışma Hayatı",
    titleDe: "Arbeit, Beruf & Karriere",
    icon: "briefcase",
    descriptionTr: "Meslekler, iş başvurusu, özgeçmiş, mülakat, sorumluluk ve projeler.",
    objectivesTr: [
      "Meslek, deneyim ve iş başvurusu kavramlarını resmi dilde kullanır.",
      "Çalışma koşullarını, hedefleri ve ekip sorumluluklarını açıklar.",
    ],
    levels: ["A1", "A2", "B1", "B2", "C1"],
    defaultSubtopicTr: "Meslek ve İş Dünyası",
    defaultSubtopicDe: "Berufsleben und Bewerbung",
  },
  {
    id: "health_body",
    order: 10,
    titleTr: "Sağlık, Vücut ve Doktor",
    titleDe: "Gesundheit, Körper & Medizin",
    icon: "heart-pulse",
    descriptionTr: "Sağlıklı yaşam, doktor muayenesi, ilaçlar, dinlenme ve beden sağlığı.",
    objectivesTr: [
      "Doktor randevusu, şikâyet ve ilaç kullanım ifadelerini kurar.",
      "Sağlıklı yaşam alışkanlıklarını öneri kalıplarıyla anlatır.",
    ],
    levels: ["A1", "A2", "B1", "B2"],
    defaultSubtopicTr: "Sağlık ve Muayene",
    defaultSubtopicDe: "Gesundheit und Arztbesuch",
  },
  {
    id: "nature_weather",
    order: 11,
    titleTr: "Hava Durumu, Doğa ve Çevre",
    titleDe: "Wetter, Natur & Umwelt",
    icon: "leaf",
    descriptionTr: "Hava durumu, mevsimler, çevre koruma, iklim değişikliği ve sürdürülebilirlik.",
    objectivesTr: [
      "Hava durumu ve doğa olaylarını günlük konuşmada betimler.",
      "Çevre koruma, iklim ve sürdürülebilirlik üzerine görüş bildirir.",
    ],
    levels: ["A1", "A2", "B1", "B2", "C1"],
    defaultSubtopicTr: "Doğa, Hava ve Çevre",
    defaultSubtopicDe: "Wetter, Natur und Ökologie",
  },
  {
    id: "hobbies_media",
    order: 12,
    titleTr: "İletişim, Teknoloji, Medya ve Hobiler",
    titleDe: "Kommunikation, Medien & Freizeit",
    icon: "smartphone",
    descriptionTr: "Telefon, mesajlaşma, dijital medya, boş zaman etkinlikleri ve kültür.",
    objectivesTr: [
      "İletişim araçlarını ve boş zaman etkinliklerini doğru fiillerle anlatır.",
      "Dijitalleşme ve sosyal medyanın etkilerini değerlendirir.",
    ],
    levels: ["A1", "A2", "B1", "B2", "C1"],
    defaultSubtopicTr: "İletişim ve Boş Zaman",
    defaultSubtopicDe: "Medien und Freizeit",
  },
  {
    id: "public_services",
    order: 13,
    titleTr: "Kamu Hizmetleri ve Günlük İşlemler",
    titleDe: "Behörden, Post & Dienstleistungen",
    icon: "building-2",
    descriptionTr: "Postane, banka, resmi kurumlar, kurallar ve şehir yaşamı işlemleri.",
    objectivesTr: [
      "Postane, banka ve resmi dairelerdeki temel işlemleri yürütür.",
      "Kuralları, izinleri ve önlemleri modal ve edilgen yapılarla açıklar.",
    ],
    levels: ["A1", "A2", "B1", "B2"],
    defaultSubtopicTr: "Kurumlar ve Hizmetler",
    defaultSubtopicDe: "Öffentliche Dienste",
  },
  {
    id: "opinions_society",
    order: 14,
    titleTr: "Görüşler, Duygular ve Toplum",
    titleDe: "Meinung, Gefühle & Gesellschaft",
    icon: "message-square",
    descriptionTr: "Fikir beyan etme, avantaj/dezavantaj, karar verme, toplumsal çeşitlilik ve uzlaşı.",
    objectivesTr: [
      "Kendi görüşünü, memnuniyetini ve kararlarını gerekçeleriyle açıklar.",
      "Toplumsal konuları avantaj ve dezavantajlarıyla tartışır.",
    ],
    levels: ["A2", "B1", "B2", "C1"],
    defaultSubtopicTr: "Görüş ve Toplumsal Yaşam",
    defaultSubtopicDe: "Meinung und Gesellschaft",
  },
  {
    id: "grammar_connectors",
    order: 15,
    titleTr: "Günlük İletişimde Dilbilgisi ve Bağlaçlar",
    titleDe: "Verben, Konnektoren & Satzstrukturen",
    icon: "sparkles",
    descriptionTr: "Temel ve modal fiiller, yan cümle bağlaçları ve kalıp cümle yapıları.",
    objectivesTr: [
      "Modal fiilleri ve ayrılabilen fiilleri doğru cümle çerçevesinde kullanır.",
      "Sebep, sonuç ve zıtlık bağlaçlarıyla bileşik cümleler kurar.",
    ],
    levels: ["A1", "A2", "B1", "B2", "C1"],
    defaultSubtopicTr: "Fiiller ve Bağlaçlar",
    defaultSubtopicDe: "Verben und Konnektoren",
  },
  {
    id: "academic_discourse",
    order: 16,
    titleTr: "Akademik Dil, Analiz ve İleri Söylem",
    titleDe: "Wissenschaft, Analyse & Diskurs",
    icon: "book-open-check",
    descriptionTr: "İleri düzey analiz, argümantasyon, hipotez, bağlam ve akademik fiiller.",
    objectivesTr: [
      "Soyut akademik kavramları ve neden-sonuç ilişkilerini nüanslı biçimde kullanır.",
      "Bilimsel iddiaları sorgulama, kanıtlama ve somutlaştırma yapılarını kurar.",
    ],
    levels: ["B2", "C1"],
    defaultSubtopicTr: "Akademik Analiz ve Argümantasyon",
    defaultSubtopicDe: "Wissenschaftlicher Diskurs",
  },
];

export const CATEGORY_BY_ID = new Map<string, CurriculumCategoryDef>(
  GERMAN_CURRICULUM_CATEGORIES.map((c) => [c.id, c]),
);

/**
 * Detects corrupted or fragmented topic labels caused by raw document lines
 * (such as `TR: „die Tiefkühltruhe..."`, example sentences, or single vocabulary lines).
 */
export function isCorruptedTopicLabel(rawTopic: string | undefined | null): boolean {
  if (!rawTopic) return true;
  const trimmed = rawTopic.normalize("NFC").trim();
  if (!trimmed) return true;
  if (trimmed.length > 52) return true;
  // Detect `TR:`, `DE:`, `Örnek:`, `Bsp:`, quotes, ellipsis, or sentence punctuation
  if (/^(?:tr|de|örnek|ornek|bsp|beispiel|not|ipucu|hint|cevap|anlamı|anlami)\s*[:\-„“"']/iu.test(trimmed)) {
    return true;
  }
  if (/[„“"«»…?!;]/u.test(trimmed)) return true;
  // Detect lines starting with German articles that are actually vocabulary items
  if (/^(?:der|die|das|ein|eine|sich)\s+[a-zäöüß]/iu.test(trimmed)) return true;
  // Detect full sentences with conjugated verbs or periods
  if (/\.\s*$/u.test(trimmed) || trimmed.split(/\s+/u).length > 6) return true;
  return false;
}

export function sanitizeLegacyTopic(rawTopic: string | undefined | null): string {
  if (!rawTopic || isCorruptedTopicLabel(rawTopic)) {
    return "";
  }
  return rawTopic.normalize("NFC").trim();
}

export interface WordClassificationResult {
  categoryId: string;
  categoryTitleTr: string;
  categoryTitleDe: string;
  subtopicTr: string;
  subtopicDe: string;
  cleanTopic: string;
  semanticTags: string[];
  inferredPos: PartOfSpeech;
}

const EXACT_WORD_CATEGORY_OVERRIDES: Record<
  string,
  { categoryId: string; subtopicTr: string; subtopicDe: string; tags: string[] }
> = {
  // A1 Personal & Greetings
  "guten morgen": { categoryId: "personal_intro", subtopicTr: "Selamlaşma ve Vedalaşma", subtopicDe: "Begrüßung & Abschied", tags: ["greeting", "polite"] },
  "guten tag": { categoryId: "personal_intro", subtopicTr: "Selamlaşma ve Vedalaşma", subtopicDe: "Begrüßung & Abschied", tags: ["greeting", "polite"] },
  "guten abend": { categoryId: "personal_intro", subtopicTr: "Selamlaşma ve Vedalaşma", subtopicDe: "Begrüßung & Abschied", tags: ["greeting", "polite"] },
  "auf wiedersehen": { categoryId: "personal_intro", subtopicTr: "Selamlaşma ve Vedalaşma", subtopicDe: "Begrüßung & Abschied", tags: ["farewell", "polite"] },
  "entschuldigung": { categoryId: "personal_intro", subtopicTr: "Nezaket ve İletişim", subtopicDe: "Höflichkeit", tags: ["polite"] },
  "danke": { categoryId: "personal_intro", subtopicTr: "Nezaket ve İletişim", subtopicDe: "Höflichkeit", tags: ["polite"] },
  "bitte": { categoryId: "personal_intro", subtopicTr: "Nezaket ve İletişim", subtopicDe: "Höflichkeit", tags: ["polite"] },
  "heißen": { categoryId: "personal_intro", subtopicTr: "Tanışma Fiilleri", subtopicDe: "Vorstellung", tags: ["person", "intro_verb"] },
  "kommen": { categoryId: "personal_intro", subtopicTr: "Tanışma ve Köken", subtopicDe: "Herkunft", tags: ["action_motion", "intro_verb"] },
  "sprechen": { categoryId: "personal_intro", subtopicTr: "Dil ve İletişim", subtopicDe: "Sprache", tags: ["action_communication"] },
  "sein": { categoryId: "personal_intro", subtopicTr: "Kimlik ve Durum (sein/haben)", subtopicDe: "Sein und Haben", tags: ["core_verb"] },
  "haben": { categoryId: "personal_intro", subtopicTr: "Kimlik ve Durum (sein/haben)", subtopicDe: "Sein und Haben", tags: ["core_verb"] },

  // Family & Social
  "die familie": { categoryId: "family_social", subtopicTr: "Aile Bireyleri", subtopicDe: "Familienmitglieder", tags: ["person", "family"] },
  "die mutter": { categoryId: "family_social", subtopicTr: "Aile Bireyleri", subtopicDe: "Familienmitglieder", tags: ["person", "family"] },
  "der vater": { categoryId: "family_social", subtopicTr: "Aile Bireyleri", subtopicDe: "Familienmitglieder", tags: ["person", "family"] },
  "das kind": { categoryId: "family_social", subtopicTr: "Aile Bireyleri", subtopicDe: "Familienmitglieder", tags: ["person", "family"] },
  "der freund": { categoryId: "family_social", subtopicTr: "Arkadaşlık ve Sosyal Çevre", subtopicDe: "Freunde", tags: ["person", "social"] },
  "die freundin": { categoryId: "family_social", subtopicTr: "Arkadaşlık ve Sosyal Çevre", subtopicDe: "Freunde", tags: ["person", "social"] },
  "der bruder": { categoryId: "family_social", subtopicTr: "Aile Bireyleri", subtopicDe: "Familienmitglieder", tags: ["person", "family"] },
  "die schwester": { categoryId: "family_social", subtopicTr: "Aile Bireyleri", subtopicDe: "Familienmitglieder", tags: ["person", "family"] },
  "die eltern": { categoryId: "family_social", subtopicTr: "Aile Bireyleri", subtopicDe: "Familienmitglieder", tags: ["person", "family"] },
  "das geschenk": { categoryId: "family_social", subtopicTr: "Davet ve Kutlama", subtopicDe: "Einladung & Feier", tags: ["social", "object"] },
  "die einladung": { categoryId: "family_social", subtopicTr: "Davet ve Kutlama", subtopicDe: "Einladung & Feier", tags: ["social"] },
  "einladen": { categoryId: "family_social", subtopicTr: "Davet ve Sosyal Fiiller", subtopicDe: "Soziale Verben", tags: ["social", "separable_verb"] },
  "gemeinsam": { categoryId: "family_social", subtopicTr: "Sosyal Etkileşim", subtopicDe: "Gemeinschaft", tags: ["social", "quality"] },
  "helfen": { categoryId: "family_social", subtopicTr: "Yardımlaşma ve İlişkiler", subtopicDe: "Hilfe & Unterstützung", tags: ["social", "dative_verb"] },

  // Home, Housing & Furniture
  "das haus": { categoryId: "home_housing", subtopicTr: "Ev ve Odalar", subtopicDe: "Haus und Räume", tags: ["place", "home"] },
  "das zimmer": { categoryId: "home_housing", subtopicTr: "Ev ve Odalar", subtopicDe: "Haus und Räume", tags: ["place", "home"] },
  "die wohnung": { categoryId: "home_housing", subtopicTr: "Konut ve Daire", subtopicDe: "Wohnung & Miete", tags: ["place", "home"] },
  "die küche": { categoryId: "home_housing", subtopicTr: "Ev ve Odalar", subtopicDe: "Haus und Räume", tags: ["place", "home"] },
  "der tisch": { categoryId: "home_housing", subtopicTr: "Mobilya ve Eşyalar", subtopicDe: "Möbel & Einrichtung", tags: ["object", "furniture"] },
  "der stuhl": { categoryId: "home_housing", subtopicTr: "Mobilya ve Eşyalar", subtopicDe: "Möbel & Einrichtung", tags: ["object", "furniture"] },
  "das bett": { categoryId: "home_housing", subtopicTr: "Mobilya ve Eşyalar", subtopicDe: "Möbel & Einrichtung", tags: ["object", "furniture"] },
  "der schrank": { categoryId: "home_housing", subtopicTr: "Mobilya ve Eşyalar", subtopicDe: "Möbel & Einrichtung", tags: ["object", "furniture"] },
  "der kühlschrank": { categoryId: "home_housing", subtopicTr: "Ev Aletleri ve Beyaz Eşya", subtopicDe: "Haushaltsgeräte", tags: ["object", "appliance"] },
  "die tiefkühltruhe": { categoryId: "home_housing", subtopicTr: "Ev Aletleri ve Beyaz Eşya", subtopicDe: "Haushaltsgeräte", tags: ["object", "appliance"] },
  "der schlüssel": { categoryId: "home_housing", subtopicTr: "Ev Eşyaları", subtopicDe: "Haushalt", tags: ["object", "home"] },
  "wohnen": { categoryId: "home_housing", subtopicTr: "Konut ve Yaşam", subtopicDe: "Wohnen", tags: ["home_verb"] },
  "bleiben": { categoryId: "home_housing", subtopicTr: "Konut ve Konaklama", subtopicDe: "Aufenthalt", tags: ["home_verb"] },
  "groß": { categoryId: "home_housing", subtopicTr: "Boyut ve Mekân Sıfatları", subtopicDe: "Größe & Beschreibung", tags: ["quality", "size"] },
  "klein": { categoryId: "home_housing", subtopicTr: "Boyut ve Mekân Sıfatları", subtopicDe: "Größe & Beschreibung", tags: ["quality", "size"] },
  "bequem": { categoryId: "home_housing", subtopicTr: "Konfor ve Eşya Sıfatları", subtopicDe: "Komfort", tags: ["quality", "comfort"] },

  // Food & Restaurant
  "der apfel": { categoryId: "food_restaurant", subtopicTr: "Yiyecekler ve Meyveler", subtopicDe: "Obst & Speisen", tags: ["food"] },
  "das obst": { categoryId: "food_restaurant", subtopicTr: "Yiyecekler ve Meyveler", subtopicDe: "Obst & Speisen", tags: ["food"] },
  "das brot": { categoryId: "food_restaurant", subtopicTr: "Temel Gıdalar", subtopicDe: "Grundnahrungsmittel", tags: ["food"] },
  "das wasser": { categoryId: "food_restaurant", subtopicTr: "İçecekler", subtopicDe: "Getränke", tags: ["drink"] },
  "der kaffee": { categoryId: "food_restaurant", subtopicTr: "İçecekler", subtopicDe: "Getränke", tags: ["drink"] },
  "der tee": { categoryId: "food_restaurant", subtopicTr: "İçecekler", subtopicDe: "Getränke", tags: ["drink"] },
  "die milch": { categoryId: "food_restaurant", subtopicTr: "İçecekler", subtopicDe: "Getränke", tags: ["drink"] },
  "essen": { categoryId: "food_restaurant", subtopicTr: "Beslenme ve Sipariş Fiilleri", subtopicDe: "Essen & Bestellen", tags: ["food_verb"] },
  "trinken": { categoryId: "food_restaurant", subtopicTr: "Beslenme ve Sipariş Fiilleri", subtopicDe: "Essen & Bestellen", tags: ["food_verb"] },
  "empfehlen": { categoryId: "food_restaurant", subtopicTr: "Restoran ve Öneri", subtopicDe: "Im Restaurant", tags: ["food_verb", "communication_verb"] },

  // Shopping, Clothing & Money
  "kaufen": { categoryId: "shopping_money", subtopicTr: "Alışveriş Fiilleri", subtopicDe: "Einkaufen", tags: ["shopping_verb"] },
  "einkaufen": { categoryId: "shopping_money", subtopicTr: "Alışveriş Fiilleri", subtopicDe: "Einkaufen", tags: ["shopping_verb", "separable_verb"] },
  "bezahlen": { categoryId: "shopping_money", subtopicTr: "Ödeme ve Hesap", subtopicDe: "Bezahlung", tags: ["shopping_verb"] },
  "die rechnung": { categoryId: "shopping_money", subtopicTr: "Ödeme ve Hesap", subtopicDe: "Bezahlung & Rechnung", tags: ["money", "document"] },
  "die kleidung": { categoryId: "shopping_money", subtopicTr: "Giyim ve Kıyafet", subtopicDe: "Kleidung", tags: ["clothing"] },
  "teuer": { categoryId: "shopping_money", subtopicTr: "Fiyat ve Değer Sıfatları", subtopicDe: "Preise", tags: ["price", "quality"] },
  "billig": { categoryId: "shopping_money", subtopicTr: "Fiyat ve Değer Sıfatları", subtopicDe: "Preise", tags: ["price", "quality"] },
  "neu": { categoryId: "shopping_money", subtopicTr: "Ürün Özellikleri", subtopicDe: "Produkteigenschaften", tags: ["quality"] },
  "alt": { categoryId: "shopping_money", subtopicTr: "Ürün Özellikleri", subtopicDe: "Produkteigenschaften", tags: ["quality"] },
  "nehmen": { categoryId: "shopping_money", subtopicTr: "Seçim ve Satın Alma", subtopicDe: "Auswahl", tags: ["shopping_verb"] },

  // Travel & Transport
  "die stadt": { categoryId: "travel_transport", subtopicTr: "Şehir ve Mekânlar", subtopicDe: "Stadt & Orte", tags: ["place", "city"] },
  "der bahnhof": { categoryId: "travel_transport", subtopicTr: "İstasyon ve Ulaşım Noktaları", subtopicDe: "Bahnhof & Haltestelle", tags: ["place", "transport"] },
  "der zug": { categoryId: "travel_transport", subtopicTr: "Ulaşım Araçları", subtopicDe: "Verkehrsmittel", tags: ["transport", "vehicle"] },
  "der bus": { categoryId: "travel_transport", subtopicTr: "Ulaşım Araçları", subtopicDe: "Verkehrsmittel", tags: ["transport", "vehicle"] },
  "das auto": { categoryId: "travel_transport", subtopicTr: "Ulaşım Araçları", subtopicDe: "Verkehrsmittel", tags: ["transport", "vehicle"] },
  "der urlaub": { categoryId: "travel_transport", subtopicTr: "Tatil ve Yolculuk", subtopicDe: "Urlaub & Reise", tags: ["travel"] },
  "die fahrkarte": { categoryId: "travel_transport", subtopicTr: "Bilet ve Bagaj", subtopicDe: "Tickets & Gepäck", tags: ["travel", "object"] },
  "das gepäck": { categoryId: "travel_transport", subtopicTr: "Bilet ve Bagaj", subtopicDe: "Tickets & Gepäck", tags: ["travel", "object"] },
  "gehen": { categoryId: "travel_transport", subtopicTr: "Hareket ve Yönelme Fiilleri", subtopicDe: "Fortbewegung", tags: ["action_motion"] },
  "reisen": { categoryId: "travel_transport", subtopicTr: "Tatil ve Yolculuk", subtopicDe: "Urlaub & Reise", tags: ["action_motion", "travel"] },
  "wo ist der bahnhof?": { categoryId: "travel_transport", subtopicTr: "Yol Sorma Cümleleri", subtopicDe: "Nach dem Weg fragen", tags: ["sentence", "travel"] },

  // Time & Daily Routine
  "der tag": { categoryId: "time_routine", subtopicTr: "Takvim ve Zaman Birimleri", subtopicDe: "Kalender & Zeit", tags: ["time"] },
  "die woche": { categoryId: "time_routine", subtopicTr: "Takvim ve Zaman Birimleri", subtopicDe: "Kalender & Zeit", tags: ["time"] },
  "das jahr": { categoryId: "time_routine", subtopicTr: "Takvim ve Zaman Birimleri", subtopicDe: "Kalender & Zeit", tags: ["time"] },
  "die zeit": { categoryId: "time_routine", subtopicTr: "Takvim ve Zaman Birimleri", subtopicDe: "Kalender & Zeit", tags: ["time"] },
  "der termin": { categoryId: "time_routine", subtopicTr: "Randevu ve Planlama", subtopicDe: "Termine & Planung", tags: ["time", "appointment"] },
  "heute": { categoryId: "time_routine", subtopicTr: "Zaman Zarfları", subtopicDe: "Zeitadverbien", tags: ["time_adv"] },
  "morgen": { categoryId: "time_routine", subtopicTr: "Zaman Zarfları", subtopicDe: "Zeitadverbien", tags: ["time_adv"] },
  "gestern": { categoryId: "time_routine", subtopicTr: "Zaman Zarfları", subtopicDe: "Zeitadverbien", tags: ["time_adv"] },
  "pünktlich": { categoryId: "time_routine", subtopicTr: "Randevu ve Planlama", subtopicDe: "Termine & Planung", tags: ["time_adj"] },
  "schlafen": { categoryId: "time_routine", subtopicTr: "Günlük Rutin Fiilleri", subtopicDe: "Tagesablauf", tags: ["routine_verb"] },
  "aufstehen": { categoryId: "time_routine", subtopicTr: "Günlük Rutin Fiilleri", subtopicDe: "Tagesablauf", tags: ["routine_verb", "separable_verb"] },
  "machen": { categoryId: "time_routine", subtopicTr: "Günlük Etkinlik Fiilleri", subtopicDe: "Tagesaktivitäten", tags: ["routine_verb"] },
  "vergessen": { categoryId: "time_routine", subtopicTr: "Günlük Durumlar", subtopicDe: "Alltagssituationen", tags: ["cognitive_verb"] },

  // Education & Learning
  "die schule": { categoryId: "education_learning", subtopicTr: "Okul ve Dersler", subtopicDe: "Schule & Unterricht", tags: ["place", "education"] },
  "das buch": { categoryId: "education_learning", subtopicTr: "Okuma ve Ders Araçları", subtopicDe: "Bücher & Lernmittel", tags: ["object", "education"] },
  "lernen": { categoryId: "education_learning", subtopicTr: "Öğrenme Fiilleri", subtopicDe: "Lernverben", tags: ["education_verb"] },
  "lesen": { categoryId: "education_learning", subtopicTr: "Öğrenme Fiilleri", subtopicDe: "Lernverben", tags: ["education_verb"] },
  "schreiben": { categoryId: "education_learning", subtopicTr: "Öğrenme Fiilleri", subtopicDe: "Lernverben", tags: ["education_verb"] },
  "erklären": { categoryId: "education_learning", subtopicTr: "Anlama ve Açıklama", subtopicDe: "Erklären & Verstehen", tags: ["education_verb"] },
  "verstehen": { categoryId: "education_learning", subtopicTr: "Anlama ve Açıklama", subtopicDe: "Erklären & Verstehen", tags: ["education_verb"] },
  "verbessern": { categoryId: "education_learning", subtopicTr: "Gelişim ve Karşılaştırma", subtopicDe: "Fortschritt", tags: ["education_verb"] },
  "vergleichen": { categoryId: "education_learning", subtopicTr: "Gelişim ve Karşılaştırma", subtopicDe: "Fortschritt", tags: ["education_verb"] },
  "ich lerne deutsch.": { categoryId: "education_learning", subtopicTr: "Temel Öğrenme Cümleleri", subtopicDe: "Lernsätze", tags: ["sentence", "education"] },
  "ich habe das buch gestern gelesen.": { categoryId: "education_learning", subtopicTr: "Geçmiş Zaman (Perfekt) Cümleleri", subtopicDe: "Perfekt-Sätze", tags: ["sentence", "education"] },

  // Work & Career
  "arbeiten": { categoryId: "work_career", subtopicTr: "Meslek ve Çalışma", subtopicDe: "Arbeit & Beruf", tags: ["work_verb"] },
  "der beruf": { categoryId: "work_career", subtopicTr: "Meslek ve Çalışma", subtopicDe: "Arbeit & Beruf", tags: ["work"] },
  "die erfahrung": { categoryId: "work_career", subtopicTr: "Deneyim ve Yetkinlik", subtopicDe: "Erfahrung & Kompetenz", tags: ["work", "abstract"] },
  "die bewerbung": { categoryId: "work_career", subtopicTr: "İş Başvurusu ve Mülakat", subtopicDe: "Bewerbung & Karriere", tags: ["work", "document"] },
  "das vorstellungsgespräch": { categoryId: "work_career", subtopicTr: "İş Başvurusu ve Mülakat", subtopicDe: "Bewerbung & Karriere", tags: ["work", "event"] },
  "der lebenslauf": { categoryId: "work_career", subtopicTr: "İş Başvurusu ve Mülakat", subtopicDe: "Bewerbung & Karriere", tags: ["work", "document"] },
  "die verantwortung": { categoryId: "work_career", subtopicTr: "Sorumluluk ve Başarı", subtopicDe: "Verantwortung & Ziele", tags: ["work", "abstract"] },
  "das ergebnis": { categoryId: "work_career", subtopicTr: "Sorumluluk ve Başarı", subtopicDe: "Verantwortung & Ziele", tags: ["work", "abstract"] },
  "sich bewerben": { categoryId: "work_career", subtopicTr: "Kariyer Fiilleri", subtopicDe: "Karriereverben", tags: ["work_verb", "reflexive_verb"] },
  "erreichen": { categoryId: "work_career", subtopicTr: "Kariyer Fiilleri", subtopicDe: "Karriereverben", tags: ["work_verb"] },
  "entwickeln": { categoryId: "work_career", subtopicTr: "Kariyer Fiilleri", subtopicDe: "Karriereverben", tags: ["work_verb"] },
  "die voraussetzung": { categoryId: "work_career", subtopicTr: "İş Koşulları ve Uygulama", subtopicDe: "Voraussetzungen", tags: ["work", "abstract"] },
  "umsetzen": { categoryId: "work_career", subtopicTr: "İş Koşulları ve Uygulama", subtopicDe: "Voraussetzungen", tags: ["work_verb", "separable_verb"] },
  "ich würde gern ein praktikum machen.": { categoryId: "work_career", subtopicTr: "Staj ve İstek Cümleleri", subtopicDe: "Praktikum & Wünsche", tags: ["sentence", "work"] },

  // Health & Body
  "der arzt": { categoryId: "health_body", subtopicTr: "Doktor ve Tedavi", subtopicDe: "Arzt & Behandlung", tags: ["person", "health"] },
  "die gesundheit": { categoryId: "health_body", subtopicTr: "Sağlık ve İlaçlar", subtopicDe: "Gesundheit & Medizin", tags: ["health", "abstract"] },
  "das medikament": { categoryId: "health_body", subtopicTr: "Sağlık ve İlaçlar", subtopicDe: "Gesundheit & Medizin", tags: ["health", "object"] },
  "gesund": { categoryId: "health_body", subtopicTr: "Sağlıklı Yaşam", subtopicDe: "Gesundes Leben", tags: ["health", "quality"] },

  // Nature, Weather & Environment
  "das wetter": { categoryId: "nature_weather", subtopicTr: "Hava Durumu", subtopicDe: "Wetter", tags: ["weather"] },
  "schön": { categoryId: "nature_weather", subtopicTr: "Hava ve Doğa Betimlemeleri", subtopicDe: "Wetterbeschreibung", tags: ["quality"] },
  "gut": { categoryId: "nature_weather", subtopicTr: "Hava ve Durum Betimlemeleri", subtopicDe: "Zustand", tags: ["quality"] },
  "die umwelt": { categoryId: "nature_weather", subtopicTr: "Çevre ve İklim", subtopicDe: "Umwelt & Klima", tags: ["environment"] },
  "der klimawandel": { categoryId: "nature_weather", subtopicTr: "Çevre ve İklim", subtopicDe: "Umwelt & Klima", tags: ["environment"] },
  "vermeiden": { categoryId: "nature_weather", subtopicTr: "Çevre Koruma Fiilleri", subtopicDe: "Umweltschutz", tags: ["environment_verb"] },
  "verzichten": { categoryId: "nature_weather", subtopicTr: "Çevre Koruma Fiilleri", subtopicDe: "Umweltschutz", tags: ["environment_verb", "prep_verb"] },
  "die nachhaltigkeit": { categoryId: "nature_weather", subtopicTr: "Sürdürülebilirlik", subtopicDe: "Nachhaltigkeit", tags: ["environment", "abstract"] },
  "nachhaltig": { categoryId: "nature_weather", subtopicTr: "Sürdürülebilirlik", subtopicDe: "Nachhaltigkeit", tags: ["environment", "quality"] },

  // Communication, Media & Hobbies
  "anrufen": { categoryId: "hobbies_media", subtopicTr: "Telefon ve İletişim", subtopicDe: "Telefon & Kontakt", tags: ["media_verb", "separable_verb"] },
  "beeinflussen": { categoryId: "hobbies_media", subtopicTr: "Medya ve Etkileşim", subtopicDe: "Medieneinfluss", tags: ["media_verb"] },

  // Opinions, Feelings & Society
  "zufrieden": { categoryId: "opinions_society", subtopicTr: "Duygular ve Memnuniyet", subtopicDe: "Gefühle & Zufriedenheit", tags: ["emotion", "quality"] },
  "die entscheidung": { categoryId: "opinions_society", subtopicTr: "Karar ve Hatırlama", subtopicDe: "Entscheidung & Erinnerung", tags: ["cognitive", "abstract"] },
  "sich entscheiden": { categoryId: "opinions_society", subtopicTr: "Karar ve Hatırlama", subtopicDe: "Entscheidung & Erinnerung", tags: ["cognitive_verb", "reflexive_verb"] },
  "sich erinnern": { categoryId: "opinions_society", subtopicTr: "Karar ve Hatırlama", subtopicDe: "Entscheidung & Erinnerung", tags: ["cognitive_verb", "reflexive_verb"] },
  "die gesellschaft": { categoryId: "opinions_society", subtopicTr: "Toplum ve Görüşler", subtopicDe: "Gesellschaft & Meinung", tags: ["society", "abstract"] },
  "die meinung": { categoryId: "opinions_society", subtopicTr: "Toplum ve Görüşler", subtopicDe: "Gesellschaft & Meinung", tags: ["society", "abstract"] },
  "der vorteil": { categoryId: "opinions_society", subtopicTr: "Avantaj ve Dezavantaj", subtopicDe: "Vor- und Nachteile", tags: ["argument", "abstract"] },
  "der nachteil": { categoryId: "opinions_society", subtopicTr: "Avantaj ve Dezavantaj", subtopicDe: "Vor- und Nachteile", tags: ["argument", "abstract"] },
  "vorschlagen": { categoryId: "opinions_society", subtopicTr: "Öneri ve Destek", subtopicDe: "Vorschlag & Unterstützung", tags: ["society_verb", "separable_verb"] },
  "unterstützen": { categoryId: "opinions_society", subtopicTr: "Öneri ve Destek", subtopicDe: "Vorschlag & Unterstützung", tags: ["society_verb"] },
  "die herausforderung": { categoryId: "opinions_society", subtopicTr: "Toplumsal Zorluklar ve Çözüm", subtopicDe: "Herausforderungen", tags: ["society", "abstract"] },
  "die auswirkung": { categoryId: "opinions_society", subtopicTr: "Etki ve Farkındalık", subtopicDe: "Auswirkungen & Bewusstsein", tags: ["society", "abstract"] },
  "die vielfalt": { categoryId: "opinions_society", subtopicTr: "Çeşitlilik ve Uzlaşma", subtopicDe: "Vielfalt & Kompromiss", tags: ["society", "abstract"] },
  "das bewusstsein": { categoryId: "opinions_society", subtopicTr: "Etki ve Farkındalık", subtopicDe: "Auswirkungen & Bewusstsein", tags: ["society", "abstract"] },
  "die maßnahme": { categoryId: "opinions_society", subtopicTr: "Toplumsal Önlemler", subtopicDe: "Maßnahmen", tags: ["society", "abstract"] },
  "der kompromiss": { categoryId: "opinions_society", subtopicTr: "Çeşitlilik ve Uzlaşma", subtopicDe: "Vielfalt & Kompromiss", tags: ["society", "abstract"] },
  "bewältigen": { categoryId: "opinions_society", subtopicTr: "Toplumsal Zorluklar ve Çözüm", subtopicDe: "Herausforderungen", tags: ["society_verb"] },
  "einschränken": { categoryId: "opinions_society", subtopicTr: "Toplumsal Önlemler", subtopicDe: "Maßnahmen", tags: ["society_verb", "separable_verb"] },
  "der konsens": { categoryId: "opinions_society", subtopicTr: "Kurumsal Uzlaşı ve Dayanıklılık", subtopicDe: "Konsens & Resilienz", tags: ["society", "abstract"] },
  "die resilienz": { categoryId: "opinions_society", subtopicTr: "Kurumsal Uzlaşı ve Dayanıklılık", subtopicDe: "Konsens & Resilienz", tags: ["society", "abstract"] },
  "legitimieren": { categoryId: "opinions_society", subtopicTr: "Kurumsal Uzlaşı ve Dayanıklılık", subtopicDe: "Konsens & Resilienz", tags: ["society_verb"] },

  // Grammar & Connectors
  "können": { categoryId: "grammar_connectors", subtopicTr: "Modal Fiiller (Yetenek ve İzin)", subtopicDe: "Modalverben", tags: ["modal_verb"] },
  "müssen": { categoryId: "grammar_connectors", subtopicTr: "Modal Fiiller (Zorunluluk ve İstek)", subtopicDe: "Modalverben", tags: ["modal_verb"] },
  "wollen": { categoryId: "grammar_connectors", subtopicTr: "Modal Fiiller (Zorunluluk ve İstek)", subtopicDe: "Modalverben", tags: ["modal_verb"] },
  "dürfen": { categoryId: "grammar_connectors", subtopicTr: "Modal Fiiller (Yetenek ve İzin)", subtopicDe: "Modalverben", tags: ["modal_verb"] },
  "weil": { categoryId: "grammar_connectors", subtopicTr: "Sebep ve Sonuç Bağlaçları", subtopicDe: "Kausale Konnektoren", tags: ["connector"] },
  "deswegen": { categoryId: "grammar_connectors", subtopicTr: "Sebep ve Sonuç Bağlaçları", subtopicDe: "Kausale Konnektoren", tags: ["connector"] },
  "obwohl": { categoryId: "grammar_connectors", subtopicTr: "Zıtlık ve Koşul Bağlaçları", subtopicDe: "Konzessive Konnektoren", tags: ["connector"] },
  "trotzdem": { categoryId: "grammar_connectors", subtopicTr: "Zıtlık ve Koşul Bağlaçları", subtopicDe: "Konzessive Konnektoren", tags: ["connector"] },
  "falls": { categoryId: "grammar_connectors", subtopicTr: "Zıtlık ve Koşul Bağlaçları", subtopicDe: "Konditionale Konnektoren", tags: ["connector"] },
  "infolgedessen": { categoryId: "grammar_connectors", subtopicTr: "İleri Düzey Bağlaçlar", subtopicDe: "Gehobene Konnektoren", tags: ["connector"] },
  "hingegen": { categoryId: "grammar_connectors", subtopicTr: "İleri Düzey Bağlaçlar", subtopicDe: "Gehobene Konnektoren", tags: ["connector"] },
  "nichtsdestotrotz": { categoryId: "grammar_connectors", subtopicTr: "Akademik Bağlaçlar", subtopicDe: "Wissenschaftliche Konnektoren", tags: ["connector"] },
  "insofern": { categoryId: "grammar_connectors", subtopicTr: "Akademik Bağlaçlar", subtopicDe: "Wissenschaftliche Konnektoren", tags: ["connector"] },
  "wenngleich": { categoryId: "grammar_connectors", subtopicTr: "Akademik Bağlaçlar", subtopicDe: "Wissenschaftliche Konnektoren", tags: ["connector"] },
};

const KEYWORD_DOMAIN_RULES: Array<{
  categoryId: string;
  subtopicTr: string;
  subtopicDe: string;
  tags: string[];
  pattern: RegExp;
}> = [
  {
    categoryId: "personal_intro",
    subtopicTr: "Selamlaşma ve Tanışma",
    subtopicDe: "Begrüßung & Vorstellung",
    tags: ["greeting", "intro"],
    pattern: /\b(merhaba|günaydın|iyi akşamlar|hoşça kal|görüşmek üzere|özür|afedersiniz|teşekkür|lütfen|adınız|isim|soyad|memleket|hallo|tschüss|willkommen|name|vorname|nachname|herkunft)\b/iu,
  },
  {
    categoryId: "family_social",
    subtopicTr: "Aile ve Sosyal İlişkiler",
    subtopicDe: "Familie & Beziehungen",
    tags: ["family", "social"],
    pattern: /\b(anne|baba|kardeş|abla|abi|çocuk|bebek|dede|nine|eş|akraba|arkadaş|komşu|misafir|düğün|doğum günü|hediye|davet|aile|mutter|vater|eltern|geschwister|tochter|sohn|onkel|tante|oma|opa|hochzeit|geburtstag|nachbar)\b/iu,
  },
  {
    categoryId: "home_housing",
    subtopicTr: "Ev, Mobilya ve Ev Aletleri",
    subtopicDe: "Wohnen, Möbel & Geräte",
    tags: ["home", "appliance"],
    pattern: /\b(ev|daire|konut|oda|mutfak|banyo|yatak|masa|sandalye|koltuk|kanepe|dolap|buzdolabı|derin dondurucu|tiefkühl|kühlschrank|waschmaschine|herd|ofen|lampe|teppich|fenster|tür|balkon|garten|keller|dach|miete|vermieter|umzug|mobilya|eşya|kira|taşınma)\b/iu,
  },
  {
    categoryId: "food_restaurant",
    subtopicTr: "Yiyecek, İçecek ve Mutfak",
    subtopicDe: "Essen, Trinken & Küche",
    tags: ["food", "drink"],
    pattern: /\b(elma|meyve|sebze|ekmek|su|kahve|çay|süt|peynir|yumurta|et|tavuk|balık|çorba|salata|şeker|tuz|kahvaltı|öğle yemeği|akşam yemeği|restoran|garson|menü|sipariş|lezzetli|aç|tok|obst|gemüse|fleisch|käse|frühstück|mittagessen|abendessen|getränk|speise|kellner|küche)\b/iu,
  },
  {
    categoryId: "shopping_money",
    subtopicTr: "Alışveriş, Giyim ve Fiyat",
    subtopicDe: "Einkaufen, Kleidung & Geld",
    tags: ["shopping", "money"],
    pattern: /\b(alışveriş|satın al|fiyat|pahalı|ucuz|indirim|para|nakit|kredi kartı|fatura|hesap|fiş|kasa|mağaza|market|süpermarket|kıyafet|elbise|gömlek|pantolon|ayakkabı|ceket|palto|kaufen|preis|geld|karte|kasse|supermarkt|laden|geschäft|kleidung|hose|hemd|schuh|jacke|rabatt)\b/iu,
  },
  {
    categoryId: "travel_transport",
    subtopicTr: "Seyahat ve Ulaşım",
    subtopicDe: "Reisen & Verkehr",
    tags: ["travel", "transport"],
    pattern: /\b(seyahat|yolculuk|tatil|tren|otobüs|araba|uçak|havalimanı|istasyon|gar|durak|bilet|bagaj|valiz|otel|harita|şehir|sokak|cadde|köprü|trafik|ehliyet|reisen|fahrt|flug|flughafen|bahnhof|haltestelle|zug|bus|auto|fahrrad|ticket|fahrkarte|koffer|hotel|verkehr|straße)\b/iu,
  },
  {
    categoryId: "time_routine",
    subtopicTr: "Zaman ve Günlük Rutin",
    subtopicDe: "Zeit & Tagesablauf",
    tags: ["time", "routine"],
    pattern: /\b(gün|hafta|ay|yıl|saat|dakika|sabah|öğle|akşam|gece|bugün|yarın|dün|şimdi|her zaman|sık sık|uyanmak|kalkmak|uyumak|randevu|dakik|takvim|woche|monat|stunde|minute|morgen|abend|nacht|uhr|termin|pünktlich|alltag|aufstehen|schlafen)\b/iu,
  },
  {
    categoryId: "education_learning",
    subtopicTr: "Okul, Eğitim ve Öğrenme",
    subtopicDe: "Schule, Bildung & Lernen",
    tags: ["education"],
    pattern: /\b(okul|üniversite|öğrenci|öğretmen|ders|sınav|kitap|defter|kalem|okumak|yazmak|öğrenmek|açıklamak|anlamak|dil|kelime|gramer|burs|araştırma|schule|universität|studium|schüler|student|lehrer|prüfung|unterricht|lernen|lesen|schreiben|wortschatz|grammatik)\b/iu,
  },
  {
    categoryId: "work_career",
    subtopicTr: "İş, Meslek ve Kariyer",
    subtopicDe: "Arbeit, Beruf & Karriere",
    tags: ["work"],
    pattern: /\b(iş|meslek|çalışmak|ofis|şirket|firma|maaş|başvuru|mülakat|özgeçmiş|staj|sorumluluk|toplantı|proje|müdür|iş arkadaşı|deneyim|tecrübe|kariyer|arbeit|beruf|büro|firma|unternehmen|gehalt|bewerbung|lebenslauf|praktikum|kollege|chef|erfahrung|karriere)\b/iu,
  },
  {
    categoryId: "health_body",
    subtopicTr: "Sağlık, Vücut ve Doktor",
    subtopicDe: "Gesundheit, Körper & Arzt",
    tags: ["health"],
    pattern: /\b(sağlık|doktor|hastane|eczane|ilaç|hasta|ağrı|ateş|baş|göz|el|ayak|kalp|vücut|muayene|tedavi|ambulans|arzt|krankenhaus|apotheke|medikament|krank|schmerz|fieber|körper|gesund)\b/iu,
  },
  {
    categoryId: "nature_weather",
    subtopicTr: "Hava Durumu, Doğa ve Çevre",
    subtopicDe: "Wetter, Natur & Umwelt",
    tags: ["nature", "environment"],
    pattern: /\b(hava|yağmur|kar|güneş|rüzgâr|fırtına|sıcak|soğuk|doğa|ağaç|orman|deniz|dağ|nehir|çevre|iklim|sürdürülebilir|enerji|atık|plastik|wetter|regen|schnee|sonne|wind|natur|baum|wald|meer|umwelt|klima|nachhaltig)\b/iu,
  },
  {
    categoryId: "hobbies_media",
    subtopicTr: "İletişim, Medya ve Hobiler",
    subtopicDe: "Medien, Technik & Freizeit",
    tags: ["media", "hobby"],
    pattern: /\b(telefon|aramak|mesaj|e-posta|bilgisayar|internet|medya|sosyal medya|gazete|haber|film|sinema|müzik|spor|futbol|yüzmek|oynamak|hobi|handy|telefon|anrufen|nachricht|computer|medien|zeitung|kino|musik|sport|spielen|freizeit)\b/iu,
  },
  {
    categoryId: "public_services",
    subtopicTr: "Kamu Hizmetleri ve Kurumlar",
    subtopicDe: "Behörden & Dienstleistungen",
    tags: ["public_service"],
    pattern: /\b(postane|posta|banka|belediye|polis|form|belge|kimlik|pasaport|kural|yasak|izin|güvenlik|denetim|post|bank|rathaus|behörde|amt|polizei|formular|ausweis|pass|kontrolle|sicherheit)\b/iu,
  },
  {
    categoryId: "opinions_society",
    subtopicTr: "Görüşler, Duygular ve Toplum",
    subtopicDe: "Meinung, Gefühle & Gesellschaft",
    tags: ["society", "opinion"],
    pattern: /\b(görüş|fikir|toplum|kültür|avantaj|dezavantaj|karar|memnun|mutlu|üzgün|korku|umut|çeşitlilik|farkındalık|bilinç|uzlaşma|önlem|zorluk|dayanıklılık|meinung|gesellschaft|vorteil|nachteil|entscheidung|zufrieden|vielfalt|bewusstsein|kompromiss|konsens|resilienz)\b/iu,
  },
];

export function inferPartOfSpeech(word: Pick<Vocabulary, "de" | "tr" | "pos" | "article" | "grammar">): PartOfSpeech {
  if (word.pos) return word.pos;
  const de = word.de.trim();
  if (/^(?:der|die|das)\s+/u.test(de) || Boolean(word.article)) return "noun";
  if (/[.!?]$/u.test(de) && de.split(/\s+/u).length >= 3) return "sentence";
  const norm = normalizeText(de);
  if (/^(?:sich\s+)?[a-zäöüß]{3,}(?:en|eln|ern|ieren)$/u.test(norm) && !de.includes(" ")) {
    return "verb";
  }
  if (/^(?:sich\s+)[a-zäöüß]+(?:en|n)$/u.test(norm)) {
    return "verb";
  }
  if (/\b(?:zarf|bağlaç|adverb|konnektor)\b/iu.test(word.grammar ?? "")) return "adv";
  if (/\b(?:sıfat|adjektiv)\b/iu.test(word.grammar ?? "")) return "adj";
  if (de.includes(" ")) return "phrase";
  return "adj";
}

export function classifyWordIntoHierarchy(
  word: any,
): WordClassificationResult {
  const normDe = normalizeText(word.de);
  const bareDe = stripArticle(word.de);
  const inferredPos = inferPartOfSpeech(word);
  const cleanLegacy = sanitizeLegacyTopic(word.topic);

  // Stage 1: Exact curated override
  const exact =
    EXACT_WORD_CATEGORY_OVERRIDES[normDe] ??
    EXACT_WORD_CATEGORY_OVERRIDES[bareDe];
  if (exact) {
    const cat = CATEGORY_BY_ID.get(exact.categoryId) ?? GERMAN_CURRICULUM_CATEGORIES[0];
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: exact.subtopicTr,
      subtopicDe: exact.subtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [...new Set([inferredPos, ...exact.tags])],
      inferredPos,
    };
  }

  // Stage 2: Keyword & domain analysis across de + tr + example
  const combinedText = `${word.de} ${word.tr} ${cleanLegacy} ${word.grammar ?? ""} ${word.exampleDe ?? ""} ${word.exampleTr ?? ""}`;
  for (const rule of KEYWORD_DOMAIN_RULES) {
    if (rule.pattern.test(combinedText)) {
      const cat = CATEGORY_BY_ID.get(rule.categoryId) ?? GERMAN_CURRICULUM_CATEGORIES[0];
      return {
        categoryId: cat.id,
        categoryTitleTr: cat.titleTr,
        categoryTitleDe: cat.titleDe,
        subtopicTr: rule.subtopicTr,
        subtopicDe: rule.subtopicDe,
        cleanTopic: cat.titleTr,
        semanticTags: [...new Set([inferredPos, ...rule.tags])],
        inferredPos,
      };
    }
  }

  // Stage 3: Legacy topic mapping
  const legacyNorm = normalizeText(cleanLegacy);
  if (legacyNorm.includes("yiyecek") || legacyNorm.includes("içecek") || legacyNorm.includes("mutfak")) {
    const cat = CATEGORY_BY_ID.get("food_restaurant")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "food"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("aile") || legacyNorm.includes("ev")) {
    const cat = CATEGORY_BY_ID.get("home_housing")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "home"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("seyahat") || legacyNorm.includes("ulaşım")) {
    const cat = CATEGORY_BY_ID.get("travel_transport")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "travel"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("zaman") || legacyNorm.includes("gün")) {
    const cat = CATEGORY_BY_ID.get("time_routine")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "time"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("sağlık")) {
    const cat = CATEGORY_BY_ID.get("health_body")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "health"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("doğa") || legacyNorm.includes("çevre")) {
    const cat = CATEGORY_BY_ID.get("nature_weather")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "environment"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("iş") || legacyNorm.includes("eğitim")) {
    const cat = CATEGORY_BY_ID.get("work_career")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "work"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("toplum") || legacyNorm.includes("kültür")) {
    const cat = CATEGORY_BY_ID.get("opinions_society")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "society"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("bağlaç") || legacyNorm.includes("modal") || legacyNorm.includes("fiil") || legacyNorm.includes("perfekt")) {
    const cat = CATEGORY_BY_ID.get("grammar_connectors")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cleanLegacy || cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "grammar"],
      inferredPos,
    };
  }
  if (legacyNorm.includes("akademik") || word.level === "B2" || word.level === "C1") {
    const cat = CATEGORY_BY_ID.get("academic_discourse")!;
    return {
      categoryId: cat.id,
      categoryTitleTr: cat.titleTr,
      categoryTitleDe: cat.titleDe,
      subtopicTr: cat.defaultSubtopicTr,
      subtopicDe: cat.defaultSubtopicDe,
      cleanTopic: cat.titleTr,
      semanticTags: [inferredPos, "academic"],
      inferredPos,
    };
  }

  // Stage 4: Level-appropriate fallback category
  const fallbackId =
    inferredPos === "verb" || inferredPos === "adv"
      ? "grammar_connectors"
      : word.level === "A1"
        ? "personal_intro"
        : word.level === "A2"
          ? "time_routine"
          : "opinions_society";
  const cat = CATEGORY_BY_ID.get(fallbackId)!;
  return {
    categoryId: cat.id,
    categoryTitleTr: cat.titleTr,
    categoryTitleDe: cat.titleDe,
    subtopicTr: cat.defaultSubtopicTr,
    subtopicDe: cat.defaultSubtopicDe,
    cleanTopic: cat.titleTr,
    semanticTags: [inferredPos, fallbackId],
    inferredPos,
  };
}

export interface CurriculumUnitItem {
  id: string;
  unitNumber: number;
  level: CefrLevel;
  categoryId: string;
  categoryTitleTr: string;
  titleTr: string;
  titleDe: string;
  subtopicTr: string;
  objectiveTr: string;
  estimatedMinutes: number;
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  almostMasteredWords: number;
  notLearnedWords: number;
  mistakeWords: number;
  percent: number;
  status: "completed" | "current" | "review" | "available";
  wordIds: string[];
  previewWords: Array<{ id: string; de: string; tr: string; pos?: string }>;
}

export interface CurriculumCategorySummary {
  id: string;
  categoryId: string;
  level: CefrLevel;
  order: number;
  titleTr: string;
  titleDe: string;
  icon: string;
  descriptionTr: string;
  objectivesTr: string[];
  unitCount: number;
  completedUnits: number;
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  almostMasteredWords: number;
  notLearnedWords: number;
  mistakeWords: number;
  percent: number;
  estimatedMinutes: number;
  status: "completed" | "current" | "review" | "available";
  units: CurriculumUnitItem[];
}

export interface CurriculumLevelHierarchy {
  level: CefrLevel;
  totalCategories: number;
  totalUnits: number;
  totalWords: number;
  masteredWords: number;
  percent: number;
  categories: CurriculumCategorySummary[];
}

export type EnrichedWordForHierarchy = Vocabulary & {
  mastery: MasteryRecord;
  categoryId?: string;
  unitId?: string;
  subtopicTr?: string;
  semanticTags?: string[];
};

const OPTIMAL_UNIT_SIZE = 12;
const MAX_UNIT_SIZE = 18;
const MIN_STANDALONE_UNIT_SIZE = 6;

/**
 * Splits or merges words inside a `(level, category)` into coherent Learning Units (`Ünite 1..N`).
 * Guarantees no 1-word fragmented cards when a category has multiple subtopics, and splits
 * oversized topics (e.g., 80 imported words) into 10-15 word units with clear Turkish titles.
 */
function buildUnitsForCategory(
  level: CefrLevel,
  catDef: CurriculumCategoryDef,
  words: Array<EnrichedWordForHierarchy & { classification: WordClassificationResult }>,
): CurriculumUnitItem[] {
  if (words.length === 0) return [];

  // Sort words deterministically by subtopic, POS order (noun -> verb -> adj -> adv -> phrase -> sentence), then alphabetically
  const posRank: Record<string, number> = {
    phrase: 1,
    noun: 2,
    verb: 3,
    adj: 4,
    adv: 5,
    sentence: 6,
  };
  const sorted = [...words].sort((a, b) => {
    const subCmp = a.classification.subtopicTr.localeCompare(b.classification.subtopicTr, "tr");
    if (subCmp !== 0) return subCmp;
    const pA = posRank[a.classification.inferredPos] ?? 9;
    const pB = posRank[b.classification.inferredPos] ?? 9;
    if (pA !== pB) return pA - pB;
    return a.de.localeCompare(b.de, "de");
  });

  // Group into balanced chunks of ~8-16 words
  const chunks: Array<{
    subtopics: string[];
    items: typeof sorted;
  }> = [];

  if (sorted.length <= MAX_UNIT_SIZE) {
    const distinctSubs = [...new Set(sorted.map((w) => w.classification.subtopicTr))];
    chunks.push({ subtopics: distinctSubs, items: sorted });
  } else {
    const unitCount = Math.max(1, Math.ceil(sorted.length / OPTIMAL_UNIT_SIZE));
    const chunkSize = Math.ceil(sorted.length / unitCount);
    for (let i = 0; i < sorted.length; i += chunkSize) {
      const slice = sorted.slice(i, i + chunkSize);
      if (
        slice.length < MIN_STANDALONE_UNIT_SIZE &&
        chunks.length > 0 &&
        chunks[chunks.length - 1].items.length + slice.length <= MAX_UNIT_SIZE + 2
      ) {
        chunks[chunks.length - 1].items.push(...slice);
        for (const s of slice.map((w) => w.classification.subtopicTr)) {
          if (!chunks[chunks.length - 1].subtopics.includes(s)) {
            chunks[chunks.length - 1].subtopics.push(s);
          }
        }
      } else {
        chunks.push({
          subtopics: [...new Set(slice.map((w) => w.classification.subtopicTr))],
          items: slice,
        });
      }
    }
  }

  let foundCurrent = false;
  return chunks.map((chunk, idx) => {
    const unitNumber = idx + 1;
    const unitId = `${level}:${catDef.id}:unit-${unitNumber}`;
    const totalWords = chunk.items.length;
    const masteredWords = chunk.items.filter((w) => w.mastery.masteryStatus === "mastered").length;
    const almostMasteredWords = chunk.items.filter(
      (w) => w.mastery.masteryStatus === "almost_mastered",
    ).length;
    const learningWords = chunk.items.filter((w) => w.mastery.masteryStatus === "learning").length;
    const notLearnedWords = Math.max(
      0,
      totalWords - masteredWords - almostMasteredWords - learningWords,
    );
    const mistakeWords = chunk.items.filter(
      (w) => w.mastery.totalIncorrect > 0 && w.mastery.masteryStatus !== "mastered",
    ).length;
    const percent = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;
    const inProgress = chunk.items.some(
      (w) => w.mastery.totalCorrect > 0 || w.mastery.totalIncorrect > 0,
    );

    let status: "completed" | "current" | "review" | "available" = "available";
    if (totalWords > 0 && masteredWords === totalWords) {
      status = "completed";
    } else if (mistakeWords > 0) {
      status = "review";
    } else if (!foundCurrent && (inProgress || idx === 0)) {
      status = "current";
      foundCurrent = true;
    }

    const primarySubtopic = chunk.subtopics[0] || catDef.defaultSubtopicTr;
    const secondarySubtopic = chunk.subtopics[1];
    const subLabel =
      chunks.length === 1
        ? primarySubtopic
        : secondarySubtopic && secondarySubtopic !== primarySubtopic
          ? `${primarySubtopic} & ${secondarySubtopic}`
          : chunks.length > 1
            ? `${primarySubtopic} (${unitNumber}. Bölüm)`
            : primarySubtopic;

    return {
      id: unitId,
      unitNumber,
      level,
      categoryId: catDef.id,
      categoryTitleTr: catDef.titleTr,
      titleTr: `Ünite ${unitNumber} — ${subLabel}`,
      titleDe: `Einheit ${unitNumber} — ${catDef.defaultSubtopicDe}`,
      subtopicTr: subLabel,
      objectiveTr: catDef.objectivesTr[idx % catDef.objectivesTr.length] ?? catDef.descriptionTr,
      estimatedMinutes: Math.max(3, Math.ceil(totalWords * 0.75)),
      totalWords,
      masteredWords,
      learningWords,
      almostMasteredWords,
      notLearnedWords,
      mistakeWords,
      percent,
      status,
      wordIds: chunk.items.map((w) => w.id),
      previewWords: chunk.items.slice(0, 5).map((w) => ({
        id: w.id,
        de: w.de,
        tr: w.tr,
        pos: w.classification.inferredPos,
      })),
    };
  });
}

export function buildHierarchicalCurriculum(
  words: EnrichedWordForHierarchy[],
): {
  hierarchyByLevel: CurriculumLevelHierarchy[];
  wordUnitAssignment: Map<
    string,
    {
      categoryId: string;
      categoryTitleTr: string;
      unitId: string;
      unitTitleTr: string;
      subtopicTr: string;
      semanticTags: string[];
      pos: PartOfSpeech;
    }
  >;
} {
  const wordUnitAssignment = new Map<
    string,
    {
      categoryId: string;
      categoryTitleTr: string;
      unitId: string;
      unitTitleTr: string;
      subtopicTr: string;
      semanticTags: string[];
      pos: PartOfSpeech;
    }
  >();

  const hierarchyByLevel: CurriculumLevelHierarchy[] = studyLevels.map((lvl) => {
    const levelWords = words
      .filter((w) => w.level === lvl)
      .map((w) => ({
        ...w,
        mastery: w.mastery ?? {
          wordId: w.id,
          cefrLevel: w.level,
          consecutiveCorrect: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          masteryStatus: "not_learned" as const,
          lastPracticedAt: null,
          masteredAt: null,
        },
        classification: classifyWordIntoHierarchy(w),
      }));

    const byCategory = new Map<string, typeof levelWords>();
    for (const item of levelWords) {
      const cid = item.classification.categoryId;
      byCategory.set(cid, [...(byCategory.get(cid) ?? []), item]);
    }

    // Consolidate tiny 1-word orphan categories if another related category in the same level exists
    // ONLY when total level words > 30 and a category has just 1 item that can join grammar_connectors or opinions_society
    for (const [cid, list] of [...byCategory.entries()]) {
      if (levelWords.length > 35 && list.length === 1 && cid !== "grammar_connectors") {
        const targetFallback =
          lvl === "B2" || lvl === "C1"
            ? "academic_discourse"
            : list[0].classification.inferredPos === "verb"
              ? "grammar_connectors"
              : null;
        if (targetFallback && targetFallback !== cid && byCategory.has(targetFallback)) {
          byCategory.get(targetFallback)!.push(...list);
          byCategory.delete(cid);
        }
      }
    }

    let foundCurrentCat = false;
    const categories: CurriculumCategorySummary[] = [];

    for (const catDef of GERMAN_CURRICULUM_CATEGORIES) {
      const catWords = byCategory.get(catDef.id) ?? [];
      if (catWords.length === 0) continue;

      const units = buildUnitsForCategory(lvl, catDef, catWords);
      for (const u of units) {
        for (const wid of u.wordIds) {
          const matched = catWords.find((cw) => cw.id === wid);
          if (matched) {
            wordUnitAssignment.set(wid, {
              categoryId: catDef.id,
              categoryTitleTr: catDef.titleTr,
              unitId: u.id,
              unitTitleTr: u.titleTr,
              subtopicTr: matched.classification.subtopicTr,
              semanticTags: matched.classification.semanticTags,
              pos: matched.classification.inferredPos,
            });
          }
        }
      }

      const totalWords = catWords.length;
      const masteredWords = catWords.filter((w) => w.mastery.masteryStatus === "mastered").length;
      const almostMasteredWords = catWords.filter(
        (w) => w.mastery.masteryStatus === "almost_mastered",
      ).length;
      const learningWords = catWords.filter((w) => w.mastery.masteryStatus === "learning").length;
      const notLearnedWords = Math.max(
        0,
        totalWords - masteredWords - almostMasteredWords - learningWords,
      );
      const mistakeWords = catWords.filter(
        (w) => w.mastery.totalIncorrect > 0 && w.mastery.masteryStatus !== "mastered",
      ).length;
      const percent = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;
      const completedUnits = units.filter((u) => u.status === "completed").length;
      const inProgress = catWords.some(
        (w) => w.mastery.totalCorrect > 0 || w.mastery.totalIncorrect > 0,
      );

      let status: "completed" | "current" | "review" | "available" = "available";
      if (totalWords > 0 && masteredWords === totalWords) {
        status = "completed";
      } else if (mistakeWords > 0) {
        status = "review";
      } else if (!foundCurrentCat && (inProgress || categories.length === 0)) {
        status = "current";
        foundCurrentCat = true;
      }

      categories.push({
        id: `${lvl}:${catDef.id}`,
        categoryId: catDef.id,
        level: lvl,
        order: catDef.order,
        titleTr: catDef.titleTr,
        titleDe: catDef.titleDe,
        icon: catDef.icon,
        descriptionTr: catDef.descriptionTr,
        objectivesTr: catDef.objectivesTr,
        unitCount: units.length,
        completedUnits,
        totalWords,
        masteredWords,
        learningWords,
        almostMasteredWords,
        notLearnedWords,
        mistakeWords,
        percent,
        estimatedMinutes: units.reduce((acc, u) => acc + u.estimatedMinutes, 0),
        status,
        units,
      });
    }

    const totalWords = categories.reduce((acc, c) => acc + c.totalWords, 0);
    const masteredWords = categories.reduce((acc, c) => acc + c.masteredWords, 0);
    const totalUnits = categories.reduce((acc, c) => acc + c.unitCount, 0);

    return {
      level: lvl,
      totalCategories: categories.length,
      totalUnits,
      totalWords,
      masteredWords,
      percent: totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0,
      categories,
    };
  });

  return { hierarchyByLevel, wordUnitAssignment };
}

export function deterministicUnitHash(level: StoredCefrLevel, categoryId: string, unitNumber: number): string {
  return createHash("sha256")
    .update(`${level}:${categoryId}:unit-${unitNumber}`)
    .digest("hex")
    .slice(0, 16);
}
