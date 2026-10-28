import { HeroClass, EnemyKind } from "./types";
export const CLASSES: Record<
  HeroClass,
  {
    name: string;
    symbol: string;
    color: string;
    hp: number;
    mana: number;
    armor: number;
    damage: number;
    range: number;
    description: string;
    skills: {
      name: string;
      cost: number;
      cooldown: number;
      description: string;
    }[];
  }
> = {
  warrior: {
    name: "Savaşçı",
    symbol: "W",
    color: "#66baff",
    hp: 160,
    mana: 100,
    armor: 35,
    damage: 21,
    range: 1.5,
    description: "Ön safta koruma, sersemletme ve düşmanları üzerine çekme.",
    skills: [
      {
        name: "Kılıç",
        cost: 0,
        cooldown: 7,
        description: "Yakındaki hedefe ve çevresine kılıç darbesi.",
      },
      {
        name: "Kalkan Darbesi",
        cost: 15,
        cooldown: 80,
        description:
          "Yakın hedefi sersemletir; normal düşmanların büyüsünü keser.",
      },
      {
        name: "Savunma Duruşu",
        cost: 20,
        cooldown: 150,
        description: "6 saniye %50 hasar azaltma; hareket yavaşlar.",
      },
      {
        name: "Meydan Okuma",
        cost: 20,
        cooldown: 180,
        description: "Görüşteki yakın düşmanları 5 saniye üzerine çeker.",
      },
      {
        name: "Kale",
        cost: 40,
        cooldown: 500,
        description: "Yakındaki ekibe 8 saniyelik koruma ve 45 kalkan.",
      },
    ],
  },
  mage: {
    name: "Büyücü",
    symbol: "M",
    color: "#d5a1ff",
    hp: 80,
    mana: 120,
    armor: 8,
    damage: 19,
    range: 7,
    description: "Alan hasarı, dondurma ve dikkatli konumlanma.",
    skills: [
      {
        name: "Arkan Ok",
        cost: 0,
        cooldown: 8,
        description: "Görüş hattında ilerleyen büyü mermisi.",
      },
      {
        name: "Buz Halkası",
        cost: 22,
        cooldown: 120,
        description:
          "3 kare içindeki düşmanları dondurur. Bosslar dirençlidir.",
      },
      {
        name: "Ateş Topu",
        cost: 25,
        cooldown: 90,
        description: "Hedef bölgeye hasar ve 4 saniye yanma.",
      },
      {
        name: "Sıçrama",
        cost: 18,
        cooldown: 140,
        description: "En fazla 4 kare; duvarların içinden geçemez.",
      },
      {
        name: "Meteor",
        cost: 55,
        cooldown: 500,
        description: "1 saniye sonra hedef bölgeye yüksek hasar.",
      },
    ],
  },
  healer: {
    name: "Şifacı",
    symbol: "H",
    color: "#84e3ad",
    hp: 100,
    mana: 130,
    armor: 15,
    damage: 15,
    range: 6,
    description: "İyileştirme, kalkan ve arındırma. Her sınıf canlandırabilir.",
    skills: [
      {
        name: "Işık Oku",
        cost: 0,
        cooldown: 8,
        description: "Görüş hattında ilerleyen ışık mermisi.",
      },
      {
        name: "Şifa Işığı",
        cost: 25,
        cooldown: 70,
        description: "Seçilen canlı takım arkadaşına 38 can.",
      },
      {
        name: "Koruyucu Bariyer",
        cost: 25,
        cooldown: 140,
        description: "Seçilen dosta 8 saniyelik 45 kalkan; birikmez.",
      },
      {
        name: "Arındırma",
        cost: 20,
        cooldown: 180,
        description:
          "Yakındaki dostların yanma, zehir, yavaşlama etkilerini siler.",
      },
      {
        name: "Sığınak",
        cost: 55,
        cooldown: 500,
        description: "8 saniye boyunca bölgedeki dostları iyileştirir.",
      },
    ],
  },
};
export const ENEMIES: Record<
  EnemyKind,
  {
    name: string;
    symbol: string;
    hp: number;
    armor: number;
    damage: number;
    range: number;
    speed: number;
  }
> = {
  skeleton: {
    name: "İskelet",
    symbol: "s",
    hp: 40,
    armor: 8,
    damage: 11,
    range: 1.5,
    speed: 6,
  },
  archer: {
    name: "Goblin Okçu",
    symbol: "a",
    hp: 32,
    armor: 2,
    damage: 10,
    range: 6,
    speed: 6,
  },
  spider: {
    name: "Mağara Örümceği",
    symbol: "x",
    hp: 27,
    armor: 0,
    damage: 7,
    range: 1.5,
    speed: 3,
  },
  necromancer: {
    name: "Nekromansör",
    symbol: "n",
    hp: 46,
    armor: 6,
    damage: 10,
    range: 5,
    speed: 7,
  },
  guardian: {
    name: "Zırhlı Muhafız",
    symbol: "G",
    hp: 80,
    armor: 55,
    damage: 22,
    range: 2,
    speed: 9,
  },
  assassin: {
    name: "Gölge Suikastçı",
    symbol: "A",
    hp: 38,
    armor: 5,
    damage: 20,
    range: 3,
    speed: 3,
  },
  king: {
    name: "İskelet Kral",
    symbol: "K",
    hp: 280,
    armor: 25,
    damage: 24,
    range: 4,
    speed: 6,
  },
  golem: {
    name: "Kristal Golem",
    symbol: "B",
    hp: 340,
    armor: 40,
    damage: 27,
    range: 5,
    speed: 8,
  },
  warden: {
    name: "Cehennem Muhafızı",
    symbol: "Ω",
    hp: 400,
    armor: 25,
    damage: 28,
    range: 6,
    speed: 5,
  },
};
export const DIFFICULTIES = {
  explorer: { name: "Kaşif", hp: 0.75, damage: 0.65, extra: 0 },
  adventurer: { name: "Maceracı", hp: 1, damage: 1, extra: 1 },
  nightmare: { name: "Kâbus", hp: 1.25, damage: 1.25, extra: 2 },
};
export const SIGNALS = [
  "Yardım!",
  "Şifa gerekiyor!",
  "Bu hedefe saldırın!",
  "Geri çekilin!",
  "Beni takip edin!",
  "Hazırım!",
];
export const RARITIES = ["Sıradan", "Sıra dışı", "Nadir", "Epik", "Efsanevi"];
export const THEMES = [
  "Unutulmuş Yeraltı Mezarları",
  "Kristal Mağaraları",
  "Cehennem Kalesi",
];
