import cron from "node-cron";
import { Server } from "socket.io";
import { Client } from "@libsql/client";

export interface AgendaEventRow {
  id: number;
  title: string;
  event_date: string;
  event_time: string | null;
  event_type: "food" | "homework" | "exam" | "event" | "study";
  description: string | null;
  created_by: string;
  created_at: string;
}

// Track sent reminders to prevent duplicate notifications during the same minute window
const sentRemindersSet = new Set<string>();

/**
 * FMV Ayazağa Işık Lisesi 12-IB Diploma Programı Akademik Destek (Etüt) Ders Programı
 * Eylül 2026 - Ocak 2027
 * Sabah Bloğu (1-3. Dersler): 08:30 - 10:50
 * Öğle Bloğu (4-6. Dersler): 11:00 - 13:15
 */
export const FMV_AYAZAGA_12IB_ACADEMIC_SUPPORT_EVENTS = [
  // --- 26.09.2026 (Cumartesi) ---
  {
    event_date: "2026-09-26",
    event_time: "08:30 - 10:50",
    title: "Etüt: Biology SL-HL / Physics HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Biology SL-HL\n• Physics HL"
  },
  {
    event_date: "2026-09-26",
    event_time: "11:00 - 13:15",
    title: "Etüt: Mathematics SL-HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Mathematics SL-HL"
  },

  // --- 03.10.2026 (Cumartesi) ---
  {
    event_date: "2026-10-03",
    event_time: "08:30 - 10:50",
    title: "Etüt: Mathematics SL-HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Mathematics SL-HL"
  },
  {
    event_date: "2026-10-03",
    event_time: "11:00 - 13:15",
    title: "Etüt: Chemistry SL-HL / Turkish A-HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Chemistry SL-HL\n• Turkish A-HL"
  },

  // --- 10.10.2026 (Cumartesi) ---
  {
    event_date: "2026-10-10",
    event_time: "08:30 - 10:50",
    title: "Etüt: Physics SL-HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Physics SL-HL"
  },
  {
    event_date: "2026-10-10",
    event_time: "11:00 - 13:15",
    title: "Etüt: Mathematics HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Mathematics HL"
  },

  // --- 17.10.2026 (Cumartesi) ---
  {
    event_date: "2026-10-17",
    event_time: "08:30 - 10:50",
    title: "Etüt: Mathematics HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Mathematics HL"
  },
  {
    event_date: "2026-10-17",
    event_time: "11:00 - 13:15",
    title: "Etüt: Biology SL-HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Biology SL-HL"
  },

  // --- 24.10.2026 (Cumartesi) ---
  {
    event_date: "2026-10-24",
    event_time: "08:30 - 10:50",
    title: "Etüt: Mathematics SL-HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Mathematics SL-HL"
  },
  {
    event_date: "2026-10-24",
    event_time: "11:00 - 13:15",
    title: "Etüt: Turkish A-HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Turkish A-HL"
  },

  // --- 14.11.2026 (Cumartesi) ---
  {
    event_date: "2026-11-14",
    event_time: "08:30 - 10:50",
    title: "Etüt: Biology SL-HL / Physics HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Biology SL-HL\n• Physics HL"
  },
  {
    event_date: "2026-11-14",
    event_time: "11:00 - 13:15",
    title: "Etüt: Mathematics SL-HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Mathematics SL-HL"
  },

  // --- 05.12.2026 (Cumartesi) ---
  {
    event_date: "2026-12-05",
    event_time: "08:30 - 10:50",
    title: "Etüt: Chemistry SL-HL / Turkish A-HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Chemistry SL-HL\n• Turkish A-HL"
  },
  {
    event_date: "2026-12-05",
    event_time: "11:00 - 13:15",
    title: "Etüt: Mathematics SL-HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Mathematics SL-HL"
  },

  // --- 12.12.2026 (Cumartesi) ---
  {
    event_date: "2026-12-12",
    event_time: "08:30 - 10:50",
    title: "Etüt: Biology SL-HL / Physics HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Biology SL-HL\n• Physics HL"
  },
  {
    event_date: "2026-12-12",
    event_time: "11:00 - 13:15",
    title: "Etüt: Chemistry SL-HL / Turkish A-HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Chemistry SL-HL\n• Turkish A-HL"
  },

  // --- 19.12.2026 (Cumartesi) ---
  {
    event_date: "2026-12-19",
    event_time: "08:30 - 10:50",
    title: "Etüt: Mathematics SL-HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Mathematics SL-HL"
  },
  {
    event_date: "2026-12-19",
    event_time: "11:00 - 13:15",
    title: "Etüt: Turkish A-HL / Chemistry SL-HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Turkish A-HL\n• Chemistry SL-HL"
  },

  // --- 26.12.2026 (Cumartesi) ---
  {
    event_date: "2026-12-26",
    event_time: "08:30 - 10:50",
    title: "Etüt: Biology SL-HL / Physics HL",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• Biology SL-HL\n• Physics HL"
  },
  {
    event_date: "2026-12-26",
    event_time: "11:00 - 13:15",
    title: "Etüt: Mathematics HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Mathematics HL"
  },

  // --- 16.01.2027 (Cumartesi) ---
  {
    event_date: "2027-01-16",
    event_time: "08:30 - 10:50",
    title: "Etüt: TITC",
    event_type: "study" as const,
    description: "1-3. Dersler (08:30 - 10:50)\n• TITC"
  },
  {
    event_date: "2027-01-16",
    event_time: "11:00 - 13:15",
    title: "Etüt: Biology SL-HL / Physics HL",
    event_type: "study" as const,
    description: "4-6. Dersler (11:00 - 13:15)\n• Biology SL-HL\n• Physics HL"
  }
];

/**
 * FMV Özel Işık Okulları 1-4. Sınıflar Öğle Yemeği Menüsü (23 - 30 Eylül 2026)
 */
export const FMV_ISIK_SEPTEMBER_LUNCH_MENU = [
  {
    event_date: "2026-09-23",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Tarhana Çorba\n• Etli Taze Fasülye\n• Kabak Dolma / Yoğurt\n• Peynirli Subörek\n• Makarna Büfesi (Beyaz Sebze Sos)\n• Salata Büfesi (Ton Balık)\n• Meyve Karpuz / Yoğurt"
  },
  {
    event_date: "2026-09-24",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Düğün Çorba\n• Hindi Rosto / Elma Dilim Patates\n• Sebzeli Misket Köfte\n• Tel Şehriyeli Pirinç Pilavı\n• Makarna Büfesi (Fesleğenli Domates Sos)\n• Salata Büfesi (Yoğurtlu Amerikan Salata)\n• Dondurma / Yoğurt"
  },
  {
    event_date: "2026-09-25",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Mercimek Çorba\n• Pilav Üzeri Et Döner\n• Blanjer Patates\n• Makarna Büfesi (Pesto Sos)\n• Salata Büfesi (Şakşuka)\n• Meyve Kavun / Ayran"
  },
  {
    event_date: "2026-09-28",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Kesme Sebze Çorba\n• Etli Kurufasülye\n• Kıymalı Sebze Graten\n• Pirinç Pilavı\n• Makarna Büfesi (Domates Sos)\n• Salata Büfesi (Havuç Tarator)\n• Meyve Kavun / Cacık"
  },
  {
    event_date: "2026-09-29",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Tarhana Çorba\n• İzmir Köfte\n• Çıtır Tavuk / Patates / Hindi Çıtır\n• Cevizli Erişte Kavurma\n• Makarna Büfesi (Fesleğenli Dom. Soslu)\n• Salata Büfesi (Zeytinyağlı Sebze Buketi)\n• Mürdüm Erik / Yoğurt"
  },
  {
    event_date: "2026-09-30",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Soğuk Ayran Aşı Çorba\n• Etli Türlü\n• Kıymalı Yeşil Mercimek\n• Bulgur Pilavı\n• Makarna Büfesi (Fesleğenli Dom. Soslu)\n• Salata Büfesi (Kabak Tarator)\n• Cevizli Baklava\n• Komposto (Vişne)"
  }
];

/**
 * FMV Özel Işık Okulları 1-4. Sınıflar Öğle Yemeği Menüsü (Ekim Ayı Hafta İçi Günleri)
 * Yalnızca Öğle Yemeği (Çorba, Ana Yemek, Garnitür/Pilav/Makarna, Tatlı/Salata/Yoğurt) kalemleri
 */
export const FMV_ISIK_OCTOBER_LUNCH_MENU = [
  // 1. HAFTA
  {
    day: 1,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Sebze Çorba\n• Orman Kebabı / Hindi Döner Sote / Patates\n• Peynirli Su Böreği\n• Makarna Büfesi (Peynir Sos)\n• Salata Büfesi (Z.Y. Kırmızı Pancar Salatası)\n• Sütlaç & Yoğurt"
  },
  {
    day: 2,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Ezogelin Çorba\n• Hamburger / Elma Dilim Patates\n• Soğan Halkası\n• Makarna Büfesi (Yeşillikli Domates Sos)\n• Salata Büfesi (Tabule / Şalgamlı Kısır)\n• Mevsim Meyve Armut & Ayran"
  },
  // 2. HAFTA
  {
    day: 5,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Domates Çorba\n• Sosyete Mantı / Yoğurt\n• Sebze Buketi\n• Makarna Büfesi (Pesto Sos)\n• Salata Büfesi (Havuç Tarator)\n• Mevsim Meyve Erik & Vişne Komposto"
  },
  {
    day: 6,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Süzme Mercimek Çorba\n• Hasanpaşa Köfte / Hindi Emense / Elma Dilim Patates\n• Şehriyeli Bulgur Pilavı\n• Makarna Büfesi (Peynir Sos)\n• Salata Büfesi (Yoğurtlu Pırasa Kavurma)\n• Sütlaç & Yoğurt"
  },
  {
    day: 7,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Düğün Çorba\n• Etli Kuru Fasulye\n• Bolognez Soslu Karnabahar Mantısı\n• Pirinç Pilavı\n• Makarna Büfesi (Napoliten Sos)\n• Salata Büfesi (Ton Balığı)\n• Dondurma & Cacık"
  },
  {
    day: 8,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Şehriye Çorba\n• Kabak Dolma / Yoğurt\n• Beşamel Soslu Kıymalı Sebze Graten\n• Peynirli Gül Börek\n• Makarna Büfesi (Arabiatta Sos)\n• Salata Büfesi (Tabule)\n• Mevsim Meyve Üzüm & Çilek Komposto"
  },
  {
    day: 9,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Ezogelin Çorba\n• Sebzeli Kıbrıs Köfte / Hindi Sote / Küp Patates Kavurma\n• Arpa Şehriye Pilav\n• Makarna Büfesi (Napoliten Sos)\n• Salata Büfesi (Z.Y. Taze Fasulye)\n• Tahin Helva & Yoğurt"
  },
  // 3. HAFTA
  {
    day: 12,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Düğün Çorba\n• Etli Taze Fasulye / Etli Nohut\n• Pirinç Pilavı\n• Makarna Büfesi (Pesto Sos)\n• Salata Büfesi (Z.Y. Fırında Soslu Patlıcan)\n• Mevsim Meyve Armut & Cacık"
  },
  {
    day: 13,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Sebze Çorba\n• Izgara Köfte / Sote Patates / Hindi Gulaş\n• Domatesli Bulgur Pilavı\n• Makarna Büfesi (Beyaz Sebze Sos)\n• Salata Büfesi (Z.Y. Portakallı Pırasa)\n• Spangle Tatlı & Ayran"
  },
  {
    day: 14,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Alaca Çorba\n• Biber Dolma / Yoğurt\n• Etli Sebzeli Türlü\n• Peynirli Rulo Böreği\n• Makarna Büfesi (Napoliten Sos)\n• Salata Büfesi (Ton Balığı)\n• Yoğurt & Komposto"
  },
  {
    day: 15,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Yayla Çorba\n• İsveç Köfte / Sebze Sote / Sebzeli Hindi Sote\n• Erişte\n• Makarna Büfesi (Peynir Sos)\n• Salata Büfesi (Z.Y. Kereviz)\n• Baklava & Yoğurt"
  },
  {
    day: 16,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Antep Çorba\n• Salçalı Biftek / Patates\n• Nohutlu Pirinç Pilavı\n• Makarna Büfesi (Pesto Sos)\n• Salata Büfesi (Z.Y. Kabak Kalye)\n• Mevsim Meyve Elma & Ayran"
  },
  // 4. HAFTA
  {
    day: 19,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Tavuk Suyu Çorba\n• Kıymalı Yeşil Mercimek / Patates Oturtma\n• Pirinç Pilavı\n• Makarna Büfesi (Pesto Sos)\n• Salata Büfesi (Z.Y. Havuçlu Bamya)\n• Mevsim Meyve Mandalina & Yoğurt"
  },
  {
    day: 20,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Şefin Çorba\n• Ekşili Köfte / Piliç Haşlama\n• Bulgur Pilavı\n• Makarna Büfesi (Napoliten Sos)\n• Salata Büfesi (Z.Y. Kabak Mücver)\n• Yoğurt & Komposto"
  },
  {
    day: 21,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Mercimek Çorba\n• Etli Sebze Kebap / Erişte Kavurma\n• Makarna Büfesi (Beyaz Sebze Sos)\n• Salata Büfesi (Z.Y. Brüksel Lahana)\n• Mevsim Meyve Elma & Cacık"
  },
  {
    day: 22,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Düğün Çorba\n• Bolognez Soslu Sebze Topları / Kıymalı Ispanak / Yoğurt\n• Nohutlu Pirinç Pilavı\n• Makarna Büfesi (Sebzeli Domates Sos)\n• Salata Büfesi (Ton Balığı)\n• Mozaik Pasta & Yoğurt"
  },
  {
    day: 23,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Tarhana Çorba\n• İzmir Köfte / Çıtır Tavuk / Patates\n• Arpa Şehriye Pilav\n• Makarna Büfesi (Yeşillikli Domates Sos)\n• Salata Büfesi (Zeytinyağlı Roka Buketi)\n• Mevsim Meyve Armut & Ayran"
  },
  // 5. HAFTA
  {
    day: 26,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Kesme Sebze Çorba\n• Etli Kuru Fasulye / Kıymalı Sebze Graten\n• Pirinç Pilavı\n• Makarna Büfesi (Domates Sos)\n• Salata Büfesi (Havuç Tarator)\n• Baklava & Cacık"
  },
  {
    day: 27,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Yoğurt Çorba\n• Pilav Üzeri Et Döner / Elma Dilim Patates\n• Makarna Büfesi (Napoliten Sos)\n• Salata Büfesi (Z.Y. Pırasa)\n• Mevsim Meyve Mandalina & Ayran"
  },
  {
    day: 28,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Ezogelin Çorba\n• Etli Bezelye / Kıymalı Kabak Sandal Sefası\n• Mısırlı Pirinç Pilavı\n• Makarna Büfesi (Ton Balığı)\n• Salata Büfesi (Tabule)\n• Mevsim Meyve Elma & Yoğurt"
  },
  {
    day: 29,
    title: "Resmi Tatil",
    description: "🇹🇷 29 Ekim Cumhuriyet Bayramı nedeniyle okulumuz resmi tatildir. Yemek servisi yoktur."
  },
  {
    day: 30,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Domates Çorba\n• Hindi Tandır / Patates Kavurma\n• Yeşil Mercimekli Bulgur Pilavı\n• Makarna Büfesi (Arabiatta Sos)\n• Salata Büfesi (Yoğurtlu Pancar)\n• Çikolatalı Muhallebi & Yoğurt"
  }
];

export async function initAgendaTable(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS agenda_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_time TEXT,
    event_type TEXT NOT NULL,
    description TEXT,
    created_by TEXT DEFAULT 'emirgan',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_agenda_events_date ON agenda_events(event_date)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_agenda_events_type ON agenda_events(event_type)`);
  } catch (e) {}
}

export async function seedOctoberLunchMenu(client: Client) {
  try {
    const currentYear = new Date().getFullYear();
    const yearsToSeed = [2026, 2028, currentYear];
    const uniqueYears = Array.from(new Set(yearsToSeed));

    // 1. Seed September Menu (23 - 30 September) with clean overwrite
    for (const item of FMV_ISIK_SEPTEMBER_LUNCH_MENU) {
      await client.execute({
        sql: "DELETE FROM agenda_events WHERE event_date = ? AND event_type = 'food'",
        args: [item.event_date]
      });
      await client.execute({
        sql: `INSERT INTO agenda_events (title, event_date, event_time, event_type, description, created_by)
              VALUES (?, ?, '12:30', 'food', ?, 'emirgan')`,
        args: [item.title, item.event_date, item.description]
      });
    }

    // 2. Seed October Menu with clean overwrite
    for (const yr of uniqueYears) {
      console.log(`[Agenda] Seeding updated October Lunch Menu for year ${yr}...`);
      
      // Delete existing October food entries first to ensure clean replacement
      await client.execute({
        sql: "DELETE FROM agenda_events WHERE event_date LIKE ? AND event_type = 'food'",
        args: [`${yr}-10-%`]
      });

      for (const item of FMV_ISIK_OCTOBER_LUNCH_MENU) {
        const dateStr = `${yr}-10-${String(item.day).padStart(2, "0")}`;
        await client.execute({
          sql: `INSERT INTO agenda_events (title, event_date, event_time, event_type, description, created_by)
                VALUES (?, ?, '12:30', 'food', ?, 'emirgan')`,
          args: [item.title, dateStr, item.description]
        });
      }
    }
    // 3. Seed FMV Ayazağa 12-IB Academic Support (Etüt) Events (Sept 2026 - Jan 2027)
    await seedAcademicSupportEvents(client);
    // 4. Seed IB DP 2027 May Candidates Pre-Mock 3 Examination Schedule (12 - 23 October 2026)
    await seedPreMockExams(client);
  } catch (err) {
    console.error("[Agenda] Error seeding lunch menu:", err);
  }
}

/**
 * IB DP 2027 MAY EXAMINATION CANDIDATES PRE-MOCK 3 EXAMINATION SCHEDULE
 * 12 Ekim 2026 - 23 Ekim 2026 (Hafta 1 & Hafta 2)
 */
export const IB_DP_2027_PRE_MOCK_3_EXAM_SCHEDULE = [
  // --- HAFTA 1 (WEEK 1) ---
  // 12.10.2026 Pazartesi (Monday)
  {
    event_date: "2026-10-12",
    event_time: "08:50 - 10:20",
    title: "Sınav: Chemistry Paper 1 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["chemistry_sl", "chemistry_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Chemistry (Kimya)\n• Sınav: Paper 1\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (120 dk - Bitiş: 10:50)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-12",
    event_time: "08:50 - 10:20",
    title: "Sınav: Digital Society Paper 1 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["digital_society_sl", "digital_society_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Digital Society (Dijital Toplum)\n• Sınav: Paper 1\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (135 dk - Bitiş: 11:05)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-12",
    event_time: "08:50 - 10:20",
    title: "Sınav: Psychology Paper 1 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["psychology_sl", "psychology_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Psychology (Psikoloji)\n• Sınav: Paper 1\n• Seviye & Süre: SL & HL (90 dk - Bitiş: 10:20)\n• Başlama Saati: 08:50"
  },

  // 13.10.2026 Salı (Tuesday)
  {
    event_date: "2026-10-13",
    event_time: "08:50 - 10:20",
    title: "Sınav: Chemistry Paper 2 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["chemistry_sl", "chemistry_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Chemistry (Kimya)\n• Sınav: Paper 2\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (150 dk - Bitiş: 11:20)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-13",
    event_time: "08:50 - 10:05",
    title: "Sınav: Digital Society Paper 2 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["digital_society_sl", "digital_society_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Digital Society (Dijital Toplum)\n• Sınav: Paper 2\n• Seviye & Süre: SL & HL (75 dk - Bitiş: 10:05)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-13",
    event_time: "08:50 - 10:20",
    title: "Sınav: Psychology Paper 2 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["psychology_sl", "psychology_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Psychology (Psikoloji)\n• Sınav: Paper 2\n• Seviye & Süre: SL & HL (90 dk - Bitiş: 10:20)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-13",
    event_time: "13:35 - 14:50",
    title: "Sınav: Digital Society Paper 3 (HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["digital_society_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı (Öğleden Sonra)\n• Ders: Digital Society (Dijital Toplum)\n• Sınav: Paper 3\n• Seviye & Süre: HL (75 dk - Bitiş: 14:50)\n• Başlama Saati: 13:35"
  },
  {
    event_date: "2026-10-13",
    event_time: "13:35 - 15:20",
    title: "Sınav: Psychology Paper 3 (HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["psychology_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı (Öğleden Sonra)\n• Ders: Psychology (Psikoloji)\n• Sınav: Paper 3\n• Seviye & Süre: HL (105 dk - Bitiş: 15:20)\n• Başlama Saati: 13:35"
  },

  // 15.10.2026 Perşembe (Thursday)
  {
    event_date: "2026-10-15",
    event_time: "08:50 - 10:20",
    title: "Sınav: Mathematics Paper 1 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["math_sl", "math_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Mathematics (Matematik AA / AI)\n• Sınav: Paper 1\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (130 dk - Bitiş: 11:00)\n• Başlama Saati: 08:50"
  },

  // 16.10.2026 Cuma (Friday)
  {
    event_date: "2026-10-16",
    event_time: "08:50 - 10:20",
    title: "Sınav: Mathematics Paper 2 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["math_sl", "math_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Mathematics (Matematik AA / AI)\n• Sınav: Paper 2\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (120 dk - Bitiş: 10:50)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-16",
    event_time: "13:35 - 14:50",
    title: "Sınav: Mathematics Paper 3 (HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["math_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı (Öğleden Sonra)\n• Ders: Mathematics (Matematik HL)\n• Sınav: Paper 3\n• Seviye & Süre: HL (75 dk - Bitiş: 14:50)\n• Başlama Saati: 13:35"
  },

  // --- HAFTA 2 (WEEK 2) ---
  // 19.10.2026 Pazartesi (Monday)
  {
    event_date: "2026-10-19",
    event_time: "08:50 - 10:20",
    title: "Sınav: Physics Paper 1 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["physics_sl", "physics_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Physics (Fizik)\n• Sınav: Paper 1\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (120 dk - Bitiş: 10:50)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-19",
    event_time: "08:50 - 10:20",
    title: "Sınav: Biology Paper 1 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["biology_sl", "biology_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Biology (Biyoloji)\n• Sınav: Paper 1\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (120 dk - Bitiş: 10:50)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-19",
    event_time: "13:35 - 15:05",
    title: "Sınav: English B Paper 1",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["eng_b_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı (Öğleden Sonra)\n• Ders: English B\n• Sınav: Paper 1 (Writing)\n• Seviye & Süre: HL (90 dk - Bitiş: 15:05)\n• Başlama Saati: 13:35"
  },

  // 20.10.2026 Salı (Tuesday)
  {
    event_date: "2026-10-20",
    event_time: "08:50 - 10:20",
    title: "Sınav: Physics Paper 2 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["physics_sl", "physics_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Physics (Fizik)\n• Sınav: Paper 2\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (150 dk - Bitiş: 11:20)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-20",
    event_time: "08:50 - 10:20",
    title: "Sınav: Biology Paper 2 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["biology_sl", "biology_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Biology (Biyoloji)\n• Sınav: Paper 2\n• Seviye & Süre: SL (90 dk - Bitiş: 10:20) | HL (150 dk - Bitiş: 11:20)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-20",
    event_time: "13:35 - 14:35",
    title: "Sınav: English B Paper 2 Reading (HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["eng_b_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı (Öğleden Sonra)\n• Ders: English B\n• Sınav: Paper 2 (Reading Comprehension)\n• Seviye & Süre: HL (60 dk - Bitiş: 14:35)\n• Başlama Saati: 13:35"
  },
  {
    event_date: "2026-10-20",
    event_time: "14:35 - 15:35",
    title: "Sınav: English B Paper 2 Listening (HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["eng_b_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı (Öğleden Sonra)\n• Ders: English B\n• Sınav: Paper 2 (Listening Comprehension)\n• Seviye & Süre: HL (60 dk - Bitiş: 15:35)\n• Başlama Saati: 14:35"
  },

  // 22.10.2026 Perşembe (Thursday)
  {
    event_date: "2026-10-22",
    event_time: "08:50 - 10:05",
    title: "Sınav: Turkish A: Literature Paper 1 (SL/HL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["turkish_sl", "turkish_hl"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: Turkish A: Literature (Türk Edebiyatı)\n• Sınav: Paper 1\n• Seviye & Süre: SL (75 dk - Bitiş: 10:05) | HL (135 dk - Bitiş: 11:05)\n• Başlama Saati: 08:50"
  },
  {
    event_date: "2026-10-22",
    event_time: "13:35 - 15:05",
    title: "Sınav: TITC Paper 2 (SL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["titc"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı (Öğleden Sonra)\n• Ders: T.C. İnkılap Tarihi ve Atatürkçülük (TITC)\n• Sınav: Paper 2\n• Seviye & Süre: SL (90 dk - Bitiş: 15:05)\n• Başlama Saati: 13:35"
  },

  // 23.10.2026 Cuma (Friday)
  {
    event_date: "2026-10-23",
    event_time: "08:50 - 09:50",
    title: "Sınav: TITC Paper 1 (SL)",
    event_type: "exam" as const,
    target_roles: JSON.stringify(["titc"]),
    description: "📝 IB DP Pre-Mock 3 Deneme Sınavı\n• Ders: T.C. İnkılap Tarihi ve Atatürkçülük (TITC)\n• Sınav: Paper 1\n• Seviye & Süre: SL (60 dk - Bitiş: 09:50)\n• Başlama Saati: 08:50"
  }
];

/**
 * Seeds the official IB DP 2027 Pre-Mock 3 Examination Schedule into agenda_events table
 */
export async function seedPreMockExams(client: Client) {
  try {
    console.log("[Agenda] Seeding IB DP 2027 Pre-Mock 3 Examination Schedule (12 - 23 October 2026)...");
    for (const item of IB_DP_2027_PRE_MOCK_3_EXAM_SCHEDULE) {
      // Check for exact matching record (title and date)
      const existing = await client.execute({
        sql: "SELECT id FROM agenda_events WHERE event_date = ? AND title = ?",
        args: [item.event_date, item.title]
      });

      if (existing.rows.length === 0) {
        await client.execute({
          sql: `INSERT INTO agenda_events (title, event_date, event_time, event_type, description, target_roles, created_by)
                VALUES (?, ?, ?, 'exam', ?, ?, 'emirgan')`,
          args: [item.title, item.event_date, item.event_time, item.description, item.target_roles]
        });
      } else {
        // Ensure target_roles and description are up to date
        await client.execute({
          sql: `UPDATE agenda_events 
                SET event_time = ?, event_type = 'exam', description = ?, target_roles = ? 
                WHERE id = ?`,
          args: [item.event_time, item.description, item.target_roles, existing.rows[0].id]
        });
      }
    }
    console.log("[Agenda] IB DP 2027 Pre-Mock 3 Examination Schedule seeded successfully.");
  } catch (err) {
    console.error("[Agenda] Error seeding Pre-Mock exams:", err);
  }
}

/**
 * Seeds the FMV Ayazağa Işık Lisesi 12-IB Diploma Programı Akademik Destek (Etüt) Programı
 * into agenda_events table without duplicates.
 */
export async function seedAcademicSupportEvents(client: Client) {
  try {
    console.log("[Agenda] Seeding FMV Ayazağa 12-IB Academic Support (Etüt) program...");
    for (const item of FMV_AYAZAGA_12IB_ACADEMIC_SUPPORT_EVENTS) {
      // Check for exact matching record
      const existing = await client.execute({
        sql: "SELECT id FROM agenda_events WHERE event_date = ? AND title = ? AND event_time = ?",
        args: [item.event_date, item.title, item.event_time]
      });

      if (existing.rows.length === 0) {
        await client.execute({
          sql: `INSERT INTO agenda_events (title, event_date, event_time, event_type, description, created_by)
                VALUES (?, ?, ?, 'study', ?, 'emirgan')`,
          args: [item.title, item.event_date, item.event_time, item.description]
        });
      }
    }
  } catch (err) {
    console.error("[Agenda] Error seeding academic support events:", err);
  }
}

/**
 * Node-Cron Scheduler: Runs every minute.
 * If an event with event_time is approaching in exactly 60 or 15 minutes,
 * dispatches automated real-time reminder toast via Socket.io and logs a notification in the database.
 */
export function startAgendaCronJobs(client: Client, io: Server) {
  console.log("[Agenda] Starting minute-interval Cron job for event reminders...");

  // Run at the beginning of every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      // Format current date as YYYY-MM-DD
      const dateStr = now.toISOString().split("T")[0];
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentTotalMin = currentHour * 60 + currentMin;

      // Query today's events that have a defined time
      const res = await client.execute({
        sql: "SELECT * FROM agenda_events WHERE event_date = ? AND event_time IS NOT NULL AND event_time != ''",
        args: [dateStr]
      });

      for (const row of res.rows) {
        const ev = row as any as AgendaEventRow;
        if (!ev.event_time) continue;

        const [hStr, mStr] = ev.event_time.split(":");
        const eventH = parseInt(hStr, 10);
        const eventM = parseInt(mStr, 10);
        if (isNaN(eventH) || isNaN(eventM)) continue;

        const eventTotalMin = eventH * 60 + eventM;
        const diffMin = eventTotalMin - currentTotalMin;

        // Check for 60-minute or 15-minute reminders
        if (diffMin === 60 || diffMin === 15) {
          const reminderKey = `${ev.id}_${dateStr}_${diffMin}min`;
          if (!sentRemindersSet.has(reminderKey)) {
            sentRemindersSet.add(reminderKey);

            const timeLabel = diffMin === 60 ? "1 saat" : "15 dakika";
            const notificationContent = `⏰ Yaklaşan Etkinlik: "${ev.title}" ${timeLabel} sonra (${ev.event_time}) başlıyor!`;

            console.log(`[Agenda Cron] Triggering ${timeLabel} reminder for event: ${ev.title}`);

            // 1. Broadcast real-time Toast via Socket.io
            io.emit("new_toast", {
              title: "⏰ Yaklaşan Etkinlik",
              body: `"${ev.title}" ${timeLabel} sonra başlıyor!`,
              type: ev.event_type === "exam" ? "error" : "info",
              targetTab: "agenda"
            });

            // 2. Broadcast agenda reminder event
            io.emit("agenda_reminder", {
              event: ev,
              minutesLeft: diffMin,
              message: notificationContent
            });

            // 3. Save to global notifications table so it appears in users' Bildirimler tab
            try {
              const allUsers = await client.execute("SELECT id FROM users");
              const nowIso = new Date().toISOString();
              for (const u of allUsers.rows) {
                await client.execute({
                  sql: "INSERT INTO notifications (user_id, type, content, read, created_at) VALUES (?, 'agenda_reminder', ?, 0, ?)",
                  args: [u.id, notificationContent, nowIso]
                }).catch(() => {});
              }
              io.emit("notifications_updated");
            } catch (notifErr) {
              console.error("[Agenda Cron] Error saving notifications to DB:", notifErr);
            }
          }
        }
      }

      // Cleanup old keys at midnight
      if (currentHour === 0 && currentMin === 0) {
        sentRemindersSet.clear();
      }
    } catch (cronErr) {
      console.error("[Agenda Cron] Error running agenda check:", cronErr);
    }
  });
}
