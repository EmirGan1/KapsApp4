import { emptyEntry } from "./travel";
import type { EntryData } from "./travel";

type Recommendation = {
  id: string;
  data: EntryData;
  source: string;
  why: string;
  interests: string[];
};
const scenic = "https://www.budapestinfo.hu/en/10-best-viewpoints-in-budapest";
const water =
  "https://www.budapestinfo.hu/en/experience-the-best-water-activities-in-budapest";
const heritage =
  "https://www.budapestinfo.hu/en/the-world-heritage-tour-of-buda";
export const budapestRecommendations: Recommendation[] = [
  {
    id: "bastion",
    data: {
      ...emptyEntry(),
      title: "Balıkçı Tabyası",
      category: "Manzara",
      area: "Buda · Kale Tepesi",
      address: "Szentháromság tér, Budapest",
      lat: 47.5019,
      lng: 19.034,
      must: "visit",
      priority: 3,
      duration: 60,
      url: scenic,
      text: "Tuna ve Parlamento manzarası için bir durak. Matthias Kilisesi ve Buda Kalesi ile aynı gün gruplanabilir. Ücretli teras ve erişim koşullarını resmî kaynaktan kontrol edin.",
    },
    source: scenic,
    why: "Manzara ve yürüyüşü aynı bölgede birleştirin.",
    interests: ["manzara", "fotoğraf", "tarih", "romantik"],
  },
  {
    id: "castle",
    data: {
      ...emptyEntry(),
      title: "Buda Kalesi ve Kale Bölgesi",
      category: "Tarih",
      area: "Buda · Kale Tepesi",
      lat: 47.4962,
      lng: 19.0397,
      must: "visit",
      priority: 3,
      duration: 120,
      url: heritage,
      text: "Avlular ve tarihî sokaklar boyunca yürüyüş planlayın. Müze ziyareti için ayrı süre ayırın ve bilet koşullarını kontrol edin.",
    },
    source: heritage,
    why: "Balıkçı Tabyası ile ortak bir rota kurar.",
    interests: ["tarih", "müze", "yürüyüş"],
  },
  {
    id: "basilica",
    data: {
      ...emptyEntry(),
      title: "Aziz Stefan Bazilikası · seyir terası",
      category: "Manzara",
      area: "Pest · Merkez",
      lat: 47.5009,
      lng: 19.0539,
      priority: 2,
      duration: 60,
      must: "visit",
      url: scenic,
      text: "Merkezdeki panoramik durak. Teras erişimi, bilet ve ziyaret saatlerini güncel kaynaktan doğrulayın.",
    },
    source: scenic,
    why: "Pest merkezindeki yemek ve yürüyüş duraklarına yakın.",
    interests: ["manzara", "mimari", "fotoğraf"],
  },
  {
    id: "bath",
    data: {
      ...emptyEntry(),
      title: "Széchenyi Termal Hamamı",
      category: "Deneyim",
      area: "Pest · Városliget",
      lat: 47.5186,
      lng: 19.082,
      priority: 3,
      must: "do",
      duration: 180,
      url: water,
      text: "Termal banyo deneyimi için yarım gün ayırın. Bilet, yaş kuralı, bakım ve açılış bilgilerini işletmeden doğrulayın. Havlu, mayo ve terlik hazırlıklarını listenize ekleyin.",
    },
    source: water,
    why: "Yoğun bir gezi gününün ardından daha sakin bir seçenek.",
    interests: ["termal", "dinlenme", "deneyim"],
  },
  {
    id: "danube",
    data: {
      ...emptyEntry(),
      title: "Tuna kıyısı ve tekne deneyimi",
      category: "Deneyim",
      area: "Tuna",
      lat: 47.4987,
      lng: 19.0455,
      priority: 2,
      must: "do",
      duration: 90,
      url: water,
      text: "Kıyı yürüyüşü veya tekne turu seçeneklerini karşılaştırın. Seferler hava ve nehir koşullarına bağlıdır. İşletme ve hareket noktasını rezervasyon kaydına ekleyin.",
    },
    source: water,
    why: "İki kişi için manzara odaklı bir akşam fikri.",
    interests: ["romantik", "manzara", "tekne", "deneyim"],
  },
];
budapestRecommendations.push(
  {
    id: "gerbeaud",
    data: {
      ...emptyEntry(),
      title: "Gerbeaud Café",
      category: "Yeme içme",
      area: "Pest · Vörösmarty tér",
      address: "Vörösmarty tér 7–8, 1051 Budapest",
      lat: 47.4967,
      lng: 19.0503,
      duration: 60,
      priority: 2,
      url: "https://gerbeaud.hu/en/contact/",
      text: "Kahve ve tatlı molası için tarihî bir kafe. Menü, fiyat ve açık olduğu saatleri işletmenin resmî sayfasından kontrol edin.",
    },
    source: "https://gerbeaud.hu/en/contact/",
    why: "Pest merkezindeki yürüyüşe birlikte verilecek bir mola.",
    interests: ["kahve", "tatlı", "kafe", "yemek"],
  },
  {
    id: "market",
    data: {
      ...emptyEntry(),
      title: "Büyük Pazar Hali",
      category: "Yeme içme",
      area: "Pest · Fővám tér",
      address: "Vámház körút 1–3, Budapest",
      lat: 47.487,
      lng: 19.059,
      duration: 75,
      priority: 2,
      must: "visit",
      url: "https://www.budapestinfo.hu/en/great-market-hall",
      text: "Pazar atmosferi, yerel lezzetler ve küçük alışverişler için bir seçenek. Ziyaret gününü seçmeden önce açılış günlerini ve güncel bilgileri kontrol edin.",
    },
    source: "https://www.budapestinfo.hu/en/great-market-hall",
    why: "Yürüyüş rotasına kısa bir gastronomi durağı ekler.",
    interests: ["yemek", "pazar", "yerel", "alışveriş"],
  },
);
export function rankedRecommendations(interests: string) {
  const words = interests
    .toLocaleLowerCase("tr")
    .split(/[,;\s]+/)
    .filter(Boolean);
  return [...budapestRecommendations].sort(
    (a, b) =>
      b.interests.filter((i) => words.some((w) => i.includes(w))).length -
      a.interests.filter((i) => words.some((w) => i.includes(w))).length,
  );
}
