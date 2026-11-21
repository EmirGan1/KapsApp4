import { canonicalWordKey } from "./cefr";

export interface PronunciationGuide {
  ipa: string;
  turkishApprox: string;
  syllables: string[];
  stressSyllable: number;
  notesTr: string;
  source: "curated" | "admin" | "ai_needs_review" | "estimated";
  verified: boolean;
}

type CuratedSeed = {
  ipa: string;
  tr: string;
  syl: string[];
  stress?: number;
  note?: string;
};

/**
 * Curated, verified German IPA + Turkish phonetic guides covering the entire
 * builtin A1–C1 curriculum (175+ entries). Unlisted custom words NEVER receive
 * `verified: true` automatically; they fall back explicitly to unverified estimates.
 */
const RAW_CURATED: Record<string, CuratedSeed> = {
  // ---------------- A1 ----------------
  "der apfel": {
    ipa: "/deːɐ̯ ˈapfəl/",
    tr: "dea AP-fıl",
    syl: ["AP", "fıl"],
    note: "pf sesi dudakları birleştirip tek hamlede söylenir; sondaki -el zayıf 'ıl' gibidir.",
  },
  "das wasser": {
    ipa: "/das ˈvasɐ/",
    tr: "das VA-sa",
    syl: ["VA", "sa"],
    note: "Almanca 'w' Türkçedeki 'v' gibi okunur; sondaki '-er' hafif 'a' gibi yumuşar.",
  },
  "das brot": {
    ipa: "/das broːt/",
    tr: "das broot",
    syl: ["broot"],
    note: "o ünlüsü uzun okunur.",
  },
  "der kaffee": {
    ipa: "/deːɐ̯ ˈkafe/",
    tr: "dea KA-fe",
    syl: ["KA", "fe"],
    note: "Vurgu ilk hecededir (KA); çift e 'ee' kısa ve net 'e' okunur.",
  },
  "der tee": {
    ipa: "/deːɐ̯ teː/",
    tr: "dea tee",
    syl: ["tee"],
    note: "Çift 'ee' uzun e sesini verir.",
  },
  "die milch": {
    ipa: "/diː mɪlç/",
    tr: "dii milh",
    syl: ["milh"],
    note: "i sonrası 'ch' ince 'h/ş' arası bir nefes sesi (ich-Laut) verir.",
  },
  "das obst": {
    ipa: "/das oːpst/",
    tr: "das oopst",
    syl: ["oopst"],
    note: "Uzun 'o' ardından 'bst' sertleşerek 'pst' gibi duyulur.",
  },
  "die schule": {
    ipa: "/diː ˈʃuːlə/",
    tr: "dii ŞUU-lı",
    syl: ["ŞUU", "lı"],
    note: "'sch' Türkçedeki 'ş', sondaki '-e' hafif zayıf bir 'ı/e' (şva) sesidir.",
  },
  "das haus": {
    ipa: "/das haʊ̯s/",
    tr: "das haus",
    syl: ["haus"],
    note: "'au' çift ünlüsü 'a'dan 'u'ya kayar; baştaki 'h' hafif nefesle söylenir.",
  },
  "die familie": {
    ipa: "/diː faˈmiːli̯ə/",
    tr: "dii fa-Mİİ-li-yı",
    syl: ["fa", "Mİİ", "li", "yı"],
    stress: 1,
    note: "'ie' uzun i sesidir; vurgu ikinci hecededir.",
  },
  "die mutter": {
    ipa: "/diː ˈmʊtɐ/",
    tr: "dii MU-ta",
    syl: ["MU", "ta"],
    note: "Çift 'tt' önceki 'u'yu kısaltır; son '-er' açık 'a' gibi okunur.",
  },
  "der vater": {
    ipa: "/deːɐ̯ ˈfaːtɐ/",
    tr: "dea FAA-ta",
    syl: ["FAA", "ta"],
    note: "Almanca yerli kelimelerde baştaki 'v' genellikle 'f' olarak okunur!",
  },
  "das kind": {
    ipa: "/das kɪnt/",
    tr: "das kint",
    syl: ["kint"],
    note: "Hece/kelime sonundaki 'd' sertleşerek 't' gibi okunur (Auslautverhärtung).",
  },
  "der freund": {
    ipa: "/deːɐ̯ frɔʏ̯nt/",
    tr: "dea froynt",
    syl: ["froynt"],
    note: "'eu' sesi 'oy' okunur; sondaki 'd' ise 't' gibi sertleşir.",
  },
  "das zimmer": {
    ipa: "/das ˈtsɪmɐ/",
    tr: "das TSİ-ma",
    syl: ["TSİ", "ma"],
    note: "Almanca 'z' harfi Türkçedeki 'ts' gibi okunur.",
  },
  "der tisch": {
    ipa: "/deːɐ̯ tɪʃ/",
    tr: "dea tiş",
    syl: ["tiş"],
    note: "'sch' her zaman 'ş' sesi verir.",
  },
  "der stuhl": {
    ipa: "/deːɐ̯ ʃtuːl/",
    tr: "dea ştuul",
    syl: ["ştuul"],
    note: "Kelime başında 'st' -> 'şt' okunur; 'uh' içindeki 'h' sesliyi uzatır, okunmaz.",
  },
  "das buch": {
    ipa: "/das buːx/",
    tr: "das buuh",
    syl: ["buuh"],
    note: "u sonrası 'ch' boğazdan kalın 'h' (ach-Laut) sesiyle okunur.",
  },
  "die stadt": {
    ipa: "/diː ʃtat/",
    tr: "dii ştat",
    syl: ["ştat"],
    note: "Başta 'st' -> 'şt' olarak okunur; 'dt' kısa sert 't' sesidir.",
  },
  "der bahnhof": {
    ipa: "/deːɐ̯ ˈbaːnhoːf/",
    tr: "dea BAAN-hoof",
    syl: ["BAAN", "hoof"],
    note: "İlk 'h' ('ah') a sesini uzatır ve okunmaz; ikinci 'h' ('hof') nefesle okunur.",
  },
  "der zug": {
    ipa: "/deːɐ̯ tsuːk/",
    tr: "dea tsuuk",
    syl: ["tsuuk"],
    note: "'z' -> 'ts' okunur; kelimenin sonundaki 'g' sertleşip 'k' gibi duyulur.",
  },
  "der bus": {
    ipa: "/deːɐ̯ bʊs/",
    tr: "dea bus",
    syl: ["bus"],
  },
  "das auto": {
    ipa: "/das ˈaʊ̯to/",
    tr: "das AU-to",
    syl: ["AU", "to"],
    note: "'au' akıcı şekilde 'au' olarak okunur.",
  },
  "der tag": {
    ipa: "/deːɐ̯ taːk/",
    tr: "dea taak",
    syl: ["taak"],
    note: "Sondaki 'g' sertleşerek 'k' okunur.",
  },
  "die woche": {
    ipa: "/diː ˈvɔxə/",
    tr: "dii VO-hı",
    syl: ["VO", "hı"],
    note: "'w' -> 'v' okunur; 'o' sonrası 'ch' kalın 'h' sesidir.",
  },
  "das jahr": {
    ipa: "/das jaːɐ̯/",
    tr: "das yaa",
    syl: ["yaa"],
    note: "Almanca 'j' Türkçedeki 'y' sesidir; 'ah' uzun 'aa' okunur.",
  },
  "die zeit": {
    ipa: "/diː tsaɪ̯t/",
    tr: "dii tsayt",
    syl: ["tsayt"],
    note: "'z' -> 'ts', 'ei' -> 'ay' okunur.",
  },
  "heute": {
    ipa: "/ˈhɔʏ̯tə/",
    tr: "HOY-tı",
    syl: ["HOY", "tı"],
    note: "'eu' çift ünlüsü 'oy' olarak okunur.",
  },
  "morgen": {
    ipa: "/ˈmɔʁɡn̩/",
    tr: "MOR-gın",
    syl: ["MOR", "gın"],
  },
  "gestern": {
    ipa: "/ˈɡɛstɐn/",
    tr: "GES-tan",
    syl: ["GES", "tan"],
  },
  "guten morgen": {
    ipa: "/ˈɡuːtn̩ ˈmɔʁɡn̩/",
    tr: "GUU-tın MOR-gın",
    syl: ["GUU", "tın", "MOR", "gın"],
  },
  "auf wiedersehen": {
    ipa: "/aʊ̯f ˈviːdɐˌzeːən/",
    tr: "auf Vİİ-da-zee-ın",
    syl: ["auf", "Vİİ", "da", "zee", "ın"],
    stress: 1,
    note: "'w'->'v', 'ie'->uzun 'ii', sesliler arasındaki 's' yumuşak 'z', 'eh' uzun 'ee' okunur.",
  },
  "entschuldigung": {
    ipa: "/ɛntˈʃʊldɪɡʊŋ/",
    tr: "ent-ŞUL-di-gung",
    syl: ["ent", "ŞUL", "di", "gung"],
    stress: 1,
    note: "'sch'->'ş', sondaki 'ng' genizsi 'n' ile yumuşak bağlanır.",
  },
  "danke": {
    ipa: "/ˈdaŋkə/",
    tr: "DAN-kı",
    syl: ["DAN", "kı"],
  },
  "bitte": {
    ipa: "/ˈbɪtə/",
    tr: "Bİ-tı",
    syl: ["Bİ", "tı"],
    note: "Çift 'tt' ünlüyü kısa ve net kılar.",
  },
  "gut": {
    ipa: "/ɡuːt/",
    tr: "guut",
    syl: ["guut"],
  },
  "groß": {
    ipa: "/ɡroːs/",
    tr: "groos",
    syl: ["groos"],
    note: "'ß' (Eszett) uzun ünlü ardından gelen sert 's' sesini gösterir.",
  },
  "klein": {
    ipa: "/klaɪ̯n/",
    tr: "klayn",
    syl: ["klayn"],
    note: "'ei' her zaman 'ay' okunur.",
  },
  "neu": {
    ipa: "/nɔʏ̯/",
    tr: "noy",
    syl: ["noy"],
    note: "'eu' sesi 'oy' okunur.",
  },
  "alt": {
    ipa: "/alt/",
    tr: "alt",
    syl: ["alt"],
  },
  "teuer": {
    ipa: "/ˈtɔʏ̯ɐ/",
    tr: "TOY-a",
    syl: ["TOY", "a"],
    note: "'eu'->'oy', '-er' sonu açık 'a' gibidir.",
  },
  "billig": {
    ipa: "/ˈbɪlɪç/",
    tr: "Bİ-lih",
    syl: ["Bİ", "lih"],
    note: "Standart Almancada kelime sonundaki '-ig' genellikle hafif 'ih' okunur.",
  },
  "schön": {
    ipa: "/ʃøːn/",
    tr: "şöön",
    syl: ["şöön"],
    note: "'sch'->'ş', 'ö' uzun ve yuvarlak söylenir.",
  },
  "sein": {
    ipa: "/zaɪ̯n/",
    tr: "zayn",
    syl: ["zayn"],
    note: "Ünlü önündeki 's' yumuşak 'z', 'ei' ise 'ay' okunur.",
  },
  "haben": {
    ipa: "/ˈhaːbn̩/",
    tr: "HAA-bın",
    syl: ["HAA", "bın"],
  },
  "gehen": {
    ipa: "/ˈɡeːən/",
    tr: "GEE-ın",
    syl: ["GEE", "ın"],
    note: "Ortadaki 'h' sesliyi uzatır; ayrı bir 'h' sesi çıkarılmaz.",
  },
  "kommen": {
    ipa: "/ˈkɔmən/",
    tr: "KO-mın",
    syl: ["KO", "mın"],
  },
  "machen": {
    ipa: "/ˈmaxən/",
    tr: "MA-hın",
    syl: ["MA", "hın"],
    note: "a sonrası 'ch' kalın 'h' (ach-Laut) sesidir.",
  },
  "trinken": {
    ipa: "/ˈtrɪŋkn̩/",
    tr: "TRİN-kın",
    syl: ["TRİN", "kın"],
  },
  "essen": {
    ipa: "/ˈɛsn̩/",
    tr: "E-sın",
    syl: ["E", "sın"],
    note: "Çift 'ss' sert 's' sesi verir.",
  },
  "lernen": {
    ipa: "/ˈlɛʁnən/",
    tr: "LER-nın",
    syl: ["LER", "nın"],
  },
  "sprechen": {
    ipa: "/ˈʃprɛçn̩/",
    tr: "ŞPRE-hın",
    syl: ["ŞPRE", "hın"],
    note: "Başta 'sp'->'şp' okunur; 'e' sonrası 'ch' ince 'h' (ich-Laut) verir.",
  },
  "wohnen": {
    ipa: "/ˈvoːnən/",
    tr: "VOO-nın",
    syl: ["VOO", "nın"],
    note: "'w'->'v', 'oh'->uzun 'oo' (h okunmaz).",
  },
  "arbeiten": {
    ipa: "/ˈaʁbaɪ̯tn̩/",
    tr: "AR-bay-tın",
    syl: ["AR", "bay", "tın"],
    note: "'ei'->'ay' okunur.",
  },
  "lesen": {
    ipa: "/ˈleːzn̩/",
    tr: "LEE-zın",
    syl: ["LEE", "zın"],
    note: "İki ünlü arasında 's' yumuşak 'z' okunur.",
  },
  "schreiben": {
    ipa: "/ˈʃraɪ̯bn̩/",
    tr: "ŞRAY-bın",
    syl: ["ŞRAY", "bın"],
    note: "'sch'->'ş', 'ei'->'ay'.",
  },
  "kaufen": {
    ipa: "/ˈkaʊ̯fn̩/",
    tr: "KAU-fın",
    syl: ["KAU", "fın"],
  },
  "schlafen": {
    ipa: "/ˈʃlaːfn̩/",
    tr: "ŞLAA-fın",
    syl: ["ŞLAA", "fın"],
  },
  "ich lerne deutsch.": {
    ipa: "/ɪç ˈlɛʁnə dɔʏ̯tʃ/",
    tr: "ih LER-nı doyç",
    syl: ["ih", "LER", "nı", "doyç"],
    stress: 1,
    note: "'ch' ince nefesle, 'eu'->'oy', 'tsch'->'ç' okunur.",
  },
  "wo ist der bahnhof?": {
    ipa: "/voː ɪst deːɐ̯ ˈbaːnhoːf/",
    tr: "voo ist dea BAAN-hoof",
    syl: ["voo", "ist", "dea", "BAAN", "hoof"],
    stress: 3,
  },

  // ---------------- A2 ----------------
  "die wohnung": {
    ipa: "/diː ˈvoːnʊŋ/",
    tr: "dii VOO-nung",
    syl: ["VOO", "nung"],
    note: "'w'->'v', 'oh' uzun 'o' sesidir.",
  },
  "der termin": {
    ipa: "/deːɐ̯ tɛʁˈmiːn/",
    tr: "dea ter-MİİN",
    syl: ["ter", "MİİN"],
    stress: 1,
    note: "Vurgu ikinci hecededir (MİİN).",
  },
  "der arzt": {
    ipa: "/deːɐ̯ aːɐ̯tst/",
    tr: "dea aatst",
    syl: ["aatst"],
    note: "'z'->'ts' olarak söylenir.",
  },
  "die gesundheit": {
    ipa: "/diː ɡəˈzʊnthaɪ̯t/",
    tr: "dii gı-ZUNT-hayt",
    syl: ["gı", "ZUNT", "hayt"],
    stress: 1,
    note: "'s' yumuşak 'z', 'ei'->'ay' okunur; 'h' nefesle duyulur.",
  },
  "das medikament": {
    ipa: "/das medikaˈmɛnt/",
    tr: "das me-di-ka-MENT",
    syl: ["me", "di", "ka", "MENT"],
    stress: 3,
  },
  "das wetter": {
    ipa: "/das ˈvɛtɐ/",
    tr: "das VE-ta",
    syl: ["VE", "ta"],
  },
  "der urlaub": {
    ipa: "/deːɐ̯ ˈuːɐ̯laʊ̯p/",
    tr: "dea UUR-laup",
    syl: ["UUR", "laup"],
    note: "Kelime sonundaki 'b' sertleşip 'p' okunur.",
  },
  "die fahrkarte": {
    ipa: "/diː ˈfaːɐ̯ˌkaʁtə/",
    tr: "dii FAA-kar-tı",
    syl: ["FAA", "kar", "tı"],
    note: "'ah' içindeki 'h' okunmaz, a'yı uzatır.",
  },
  "das gepäck": {
    ipa: "/das ɡəˈpɛk/",
    tr: "das gı-PEK",
    syl: ["gı", "PEK"],
    stress: 1,
  },
  "die rechnung": {
    ipa: "/diː ˈrɛçnʊŋ/",
    tr: "dii REH-nung",
    syl: ["REH", "nung"],
    note: "e sonrası 'ch' ince 'h' (ich-Laut) verir.",
  },
  "das geschenk": {
    ipa: "/das ɡəˈʃɛŋk/",
    tr: "das gı-ŞENK",
    syl: ["gı", "ŞENK"],
    stress: 1,
  },
  "die einladung": {
    ipa: "/diː ˈaɪ̯nˌlaːdʊŋ/",
    tr: "dii AYN-laa-dung",
    syl: ["AYN", "laa", "dung"],
    note: "'ei'->'ay' okunur.",
  },
  "der beruf": {
    ipa: "/deːɐ̯ bəˈruːf/",
    tr: "dea bı-RUUF",
    syl: ["bı", "RUUF"],
    stress: 1,
  },
  "die erfahrung": {
    ipa: "/diː ɛɐ̯ˈfaːrʊŋ/",
    tr: "dii er-FAA-rung",
    syl: ["er", "FAA", "rung"],
    stress: 1,
  },
  "die kleidung": {
    ipa: "/diː ˈklaɪ̯dʊŋ/",
    tr: "dii KLAY-dung",
    syl: ["KLAY", "dung"],
  },
  "pünktlich": {
    ipa: "/ˈpʏŋktlɪç/",
    tr: "PÜNKT-lih",
    syl: ["PÜNKT", "lih"],
    note: "Sondaki '-lich' ince 'h' (ich-Laut) ile söylenir.",
  },
  "bequem": {
    ipa: "/bəˈkveːm/",
    tr: "bı-KVEEM",
    syl: ["bı", "KVEEM"],
    stress: 1,
    note: "'qu' Almancada her zaman 'kv' sesi verir!",
  },
  "gesund": {
    ipa: "/ɡəˈzʊnt/",
    tr: "gı-ZUNT",
    syl: ["gı", "ZUNT"],
    stress: 1,
    note: "Ünlü önünde 's'->'z', sonda 'd'->'t' olur.",
  },
  "zufrieden": {
    ipa: "/tsuˈfriːdn̩/",
    tr: "tsu-FRİİ-dın",
    syl: ["tsu", "FRİİ", "dın"],
    stress: 1,
    note: "'z'->'ts', 'ie'->uzun 'ii'.",
  },
  "gemeinsam": {
    ipa: "/ɡəˈmaɪ̯nzaːm/",
    tr: "gı-MAYN-zaam",
    syl: ["gı", "MAYN", "zaam"],
    stress: 1,
  },
  "weil": {
    ipa: "/vaɪ̯l/",
    tr: "vayl",
    syl: ["vayl"],
    note: "'w'->'v', 'ei'->'ay'.",
  },
  "deswegen": {
    ipa: "/ˈdɛsveːɡn̩/",
    tr: "DES-vee-gın",
    syl: ["DES", "vee", "gın"],
  },
  "aufstehen": {
    ipa: "/ˈaʊ̯fˌʃteːən/",
    tr: "AUF-ştee-ın",
    syl: ["AUF", "ştee", "ın"],
    note: "Vurgu ayrılabilen ön ek 'AUF' üzerindedir; 'st'->'şt', 'eh'->uzun 'ee'.",
  },
  "einkaufen": {
    ipa: "/ˈaɪ̯nˌkaʊ̯fn̩/",
    tr: "AYN-kau-fın",
    syl: ["AYN", "kau", "fın"],
  },
  "anrufen": {
    ipa: "/ˈanˌruːfn̩/",
    tr: "AN-ruu-fın",
    syl: ["AN", "ruu", "fın"],
  },
  "einladen": {
    ipa: "/ˈaɪ̯nˌlaːdn̩/",
    tr: "AYN-laa-dın",
    syl: ["AYN", "laa", "dın"],
  },
  "können": {
    ipa: "/ˈkœnən/",
    tr: "KÖ-nın",
    syl: ["KÖ", "nın"],
  },
  "müssen": {
    ipa: "/ˈmʏsn̩/",
    tr: "MÜ-sın",
    syl: ["MÜ", "sın"],
  },
  "wollen": {
    ipa: "/ˈvɔlən/",
    tr: "VO-lın",
    syl: ["VO", "lın"],
  },
  "dürfen": {
    ipa: "/ˈdʏʁfn̩/",
    tr: "DÜR-fın",
    syl: ["DÜR", "fın"],
  },
  "erklären": {
    ipa: "/ɛɐ̯ˈklɛːrən/",
    tr: "er-KLEE-rın",
    syl: ["er", "KLEE", "rın"],
    stress: 1,
  },
  "vergessen": {
    ipa: "/fɛɐ̯ˈɡɛsn̩/",
    tr: "fer-GE-sın",
    syl: ["fer", "GE", "sın"],
    stress: 1,
    note: "'v'->'f' olarak okunur.",
  },
  "empfehlen": {
    ipa: "/ɛmˈpfeːlən/",
    tr: "em-PFEE-lın",
    syl: ["em", "PFEE", "lın"],
    stress: 1,
    note: "'eh' içindeki 'h' okunmaz, sadece e'yi uzatır.",
  },
  "verstehen": {
    ipa: "/fɛɐ̯ˈʃteːən/",
    tr: "fer-ŞTEE-ın",
    syl: ["fer", "ŞTEE", "ın"],
    stress: 1,
    note: "'v'->'f', 'st'->'şt', 'eh'->uzun 'ee'.",
  },
  "reisen": {
    ipa: "/ˈraɪ̯zn̩/",
    tr: "RAY-zın",
    syl: ["RAY", "zın"],
  },
  "bezahlen": {
    ipa: "/bəˈtsaːlən/",
    tr: "bı-TSAA-lın",
    syl: ["bı", "TSAA", "lın"],
    stress: 1,
    note: "'z'->'ts', 'ah' uzun 'aa'.",
  },
  "helfen": {
    ipa: "/ˈhɛlfn̩/",
    tr: "HEL-fın",
    syl: ["HEL", "fın"],
  },
  "nehmen": {
    ipa: "/ˈneːmən/",
    tr: "NEE-mın",
    syl: ["NEE", "mın"],
    note: "'eh' içindeki 'h' okunmaz, e'yi uzatır.",
  },
  "bleiben": {
    ipa: "/ˈblaɪ̯bn̩/",
    tr: "BLAY-bın",
    syl: ["BLAY", "bın"],
  },
  "ich habe das buch gestern gelesen.": {
    ipa: "/ɪç ˈhaːbə das buːx ˈɡɛstɐn ɡəˈleːzn̩/",
    tr: "ih HAA-bı das buuh GES-tan gı-LEE-zın",
    syl: ["ih", "HAA", "bı", "das", "buuh", "GES", "tan", "gı", "LEE", "zın"],
    stress: 1,
  },

  // ---------------- B1 ----------------
  "die bewerbung": {
    ipa: "/diː bəˈvɛʁbʊŋ/",
    tr: "dii bı-VER-bung",
    syl: ["bı", "VER", "bung"],
    stress: 1,
  },
  "das vorstellungsgespräch": {
    ipa: "/das ˈfoːɐ̯ʃtɛlʊŋsɡəˌʃprɛːç/",
    tr: "das FOR-şte-lungs-gı-şpreyh",
    syl: ["FOR", "şte", "lungs", "gı", "şpreyh"],
    note: "Bileşik isimlerde vurgu ilk kelimededir (FOR); 'v'->'f', 'st'->'şt', 'sp'->'şp'.",
  },
  "der lebenslauf": {
    ipa: "/deːɐ̯ ˈleːbn̩sˌlaʊ̯f/",
    tr: "dea LEE-bıns-lauf",
    syl: ["LEE", "bıns", "lauf"],
  },
  "die verantwortung": {
    ipa: "/diː fɛɐ̯ˈʔantvɔʁtʊŋ/",
    tr: "dii fer-ANT-vor-tung",
    syl: ["fer", "ANT", "vor", "tung"],
    stress: 1,
    note: "'v'->'f', ikinci hecedeki 'w'->'v' okunur.",
  },
  "die umwelt": {
    ipa: "/diː ˈʊmvɛlt/",
    tr: "dii UM-velt",
    syl: ["UM", "velt"],
  },
  "der klimawandel": {
    ipa: "/deːɐ̯ ˈkliːmaˌvandl̩/",
    tr: "dea KLİİ-ma-van-dıl",
    syl: ["KLİİ", "ma", "van", "dıl"],
  },
  "die gesellschaft": {
    ipa: "/diː ɡəˈzɛlʃaft/",
    tr: "dii gı-ZEL-şaft",
    syl: ["gı", "ZEL", "şaft"],
    stress: 1,
  },
  "die meinung": {
    ipa: "/diː ˈmaɪ̯nʊŋ/",
    tr: "dii MAY-nung",
    syl: ["MAY", "nung"],
    note: "'ei'->'ay' okunur.",
  },
  "der vorteil": {
    ipa: "/deːɐ̯ ˈfoːɐ̯taɪ̯l/",
    tr: "dea FOR-tayl",
    syl: ["FOR", "tayl"],
    note: "'vor'->'for', 'ei'->'ay'.",
  },
  "der nachteil": {
    ipa: "/deːɐ̯ ˈnaːxtaɪ̯l/",
    tr: "dea NAAH-tayl",
    syl: ["NAAH", "tayl"],
    note: "a sonrası 'ch' kalın 'h' (ach-Laut) sesidir.",
  },
  "die entscheidung": {
    ipa: "/diː ɛntˈʃaɪ̯dʊŋ/",
    tr: "dii ent-ŞAY-dung",
    syl: ["ent", "ŞAY", "dung"],
    stress: 1,
  },
  "das ergebnis": {
    ipa: "/das ɛɐ̯ˈɡeːpnɪs/",
    tr: "das er-GEEP-nis",
    syl: ["er", "GEEP", "nis"],
    stress: 1,
    note: "Hece sonundaki 'b' sertleşip 'p' okunur.",
  },
  "die gewohnheit": {
    ipa: "/diː ɡəˈvoːnhaɪ̯t/",
    tr: "dii gı-VOON-hayt",
    syl: ["gı", "VOON", "hayt"],
    stress: 1,
  },
  "der erfolg": {
    ipa: "/deːɐ̯ ɛɐ̯ˈfɔlk/",
    tr: "dea er-FOLK",
    syl: ["er", "FOLK"],
    stress: 1,
    note: "Kelime sonundaki 'g' sertleşip 'k' olur.",
  },
  "die unterstützung": {
    ipa: "/diː ʊntɐˈʃtʏtsʊŋ/",
    tr: "dii un-ta-ŞTÜT-sung",
    syl: ["un", "ta", "ŞTÜT", "sung"],
    stress: 2,
    note: "'tz' sert ve net 'ts' sesidir.",
  },
  "obwohl": {
    ipa: "/ɔpˈvoːl/",
    tr: "op-VOOL",
    syl: ["op", "VOOL"],
    stress: 1,
    note: "b->p sertleşmesi ve 'w'->'v', 'oh' uzun 'o'.",
  },
  "trotzdem": {
    ipa: "/ˈtrɔtsdeːm/",
    tr: "TROTS-deem",
    syl: ["TROTS", "deem"],
  },
  "außerdem": {
    ipa: "/ˈaʊ̯sɐdeːm/",
    tr: "AU-sa-deem",
    syl: ["AU", "sa", "deem"],
  },
  "zuverlässig": {
    ipa: "/ˈtsuːfɛɐ̯ˌlɛsɪç/",
    tr: "TSUU-fer-le-sih",
    syl: ["TSUU", "fer", "le", "sih"],
    note: "'z'->'ts', 'v'->'f', '-ig' hafif 'ih' okunur.",
  },
  "selbstständig": {
    ipa: "/ˈzɛlpstˌʃtɛndɪç/",
    tr: "ZELPST-şten-dih",
    syl: ["ZELPST", "şten", "dih"],
    note: "Başta 's'->'z', ikinci parçada 'st'->'şt'.",
  },
  "notwendig": {
    ipa: "/ˈnoːtvɛndɪç/",
    tr: "NOOT-ven-dih",
    syl: ["NOOT", "ven", "dih"],
  },
  "teilnehmen": {
    ipa: "/ˈtaɪ̯lˌneːmən/",
    tr: "TAYL-nee-mın",
    syl: ["TAYL", "nee", "mın"],
  },
  "sich bewerben": {
    ipa: "/zɪç bəˈvɛʁbn̩/",
    tr: "zih bı-VER-bın",
    syl: ["zih", "bı", "VER", "bın"],
    stress: 2,
  },
  "sich entscheiden": {
    ipa: "/zɪç ɛntˈʃaɪ̯dn̩/",
    tr: "zih ent-ŞAY-dın",
    syl: ["zih", "ent", "ŞAY", "dın"],
    stress: 2,
  },
  "sich erinnern": {
    ipa: "/zɪç ɛɐ̯ˈʔɪnɐn/",
    tr: "zih er-İ-nan",
    syl: ["zih", "er", "İ", "nan"],
    stress: 2,
  },
  "vorschlagen": {
    ipa: "/ˈfoːɐ̯ˌʃlaːɡn̩/",
    tr: "FOR-şlaa-gın",
    syl: ["FOR", "şlaa", "gın"],
  },
  "vergleichen": {
    ipa: "/fɛɐ̯ˈɡlaɪ̯çn̩/",
    tr: "fer-GLAY-hın",
    syl: ["fer", "GLAY", "hın"],
    stress: 1,
  },
  "verbessern": {
    ipa: "/fɛɐ̯ˈbɛsɐn/",
    tr: "fer-BE-san",
    syl: ["fer", "BE", "san"],
    stress: 1,
  },
  "unterstützen": {
    ipa: "/ʊntɐˈʃtʏtsn̩/",
    tr: "un-ta-ŞTÜT-sın",
    syl: ["un", "ta", "ŞTÜT", "sın"],
    stress: 2,
  },
  "erreichen": {
    ipa: "/ɛɐ̯ˈraɪ̯çn̩/",
    tr: "er-RAY-hın",
    syl: ["er", "RAY", "hın"],
    stress: 1,
  },
  "entwickeln": {
    ipa: "/ɛntˈvɪkl̩n/",
    tr: "ent-VİK-ıln",
    syl: ["ent", "VİK", "ıln"],
    stress: 1,
  },
  "vermeiden": {
    ipa: "/fɛɐ̯ˈmaɪ̯dn̩/",
    tr: "fer-MAY-dın",
    syl: ["fer", "MAY", "dın"],
    stress: 1,
  },
  "verzichten": {
    ipa: "/fɛɐ̯ˈtsɪçtn̩/",
    tr: "fer-TSİH-tın",
    syl: ["fer", "TSİH", "tın"],
    stress: 1,
    note: "'v'->'f', 'z'->'ts', 'ch' ince 'h'.",
  },
  "beeinflussen": {
    ipa: "/bəˈʔaɪ̯nˌflʊsn̩/",
    tr: "bı-AYN-flu-sın",
    syl: ["bı", "AYN", "flu", "sın"],
    stress: 1,
  },
  "ich würde gern ein praktikum machen.": {
    ipa: "/ɪç ˈvʏʁdə ɡɛʁn aɪ̯n ˈpraktikʊm ˈmaxən/",
    tr: "ih VÜR-dı gern ayn PRAK-ti-kum MA-hın",
    syl: ["ih", "VÜR", "dı", "gern", "ayn", "PRAK", "ti", "kum", "MA", "hın"],
    stress: 1,
  },

  // ---------------- B2 ----------------
  "die nachhaltigkeit": {
    ipa: "/diː ˈnaːxhaltɪçkaɪ̯t/",
    tr: "dii NAAH-hal-tih-kayt",
    syl: ["NAAH", "hal", "tih", "kayt"],
  },
  "die herausforderung": {
    ipa: "/diː hɛˈraʊ̯sˌfɔʁdərʊŋ/",
    tr: "dii he-RAUS-for-dı-rung",
    syl: ["he", "RAUS", "for", "dı", "rung"],
    stress: 1,
  },
  "die voraussetzung": {
    ipa: "/diː foˈraʊ̯sˌzɛtsʊŋ/",
    tr: "dii fo-RAUS-zet-sung",
    syl: ["fo", "RAUS", "zet", "sung"],
    stress: 1,
  },
  "der zusammenhang": {
    ipa: "/deːɐ̯ tsuˈzamənˌhaŋ/",
    tr: "dea tsu-ZA-mın-hang",
    syl: ["tsu", "ZA", "mın", "hang"],
    stress: 1,
  },
  "die auswirkung": {
    ipa: "/diː ˈaʊ̯sˌvɪʁkʊŋ/",
    tr: "dii AUS-vir-kung",
    syl: ["AUS", "vir", "kung"],
  },
  "die vielfalt": {
    ipa: "/diː ˈfiːlfalt/",
    tr: "dii FİİL-falt",
    syl: ["FİİL", "falt"],
    note: "'v'->'f', 'ie' uzun 'ii'.",
  },
  "das bewusstsein": {
    ipa: "/das bəˈvʊstzaɪ̯n/",
    tr: "das bı-VUST-zayn",
    syl: ["bı", "VUST", "zayn"],
    stress: 1,
  },
  "die maßnahme": {
    ipa: "/diː ˈmaːsˌnaːmə/",
    tr: "dii MAAS-naa-mı",
    syl: ["MAAS", "naa", "mı"],
    note: "'ah' uzun 'aa' okunur.",
  },
  "der fortschritt": {
    ipa: "/deːɐ̯ ˈfɔʁtʃrɪt/",
    tr: "dea FORT-şrit",
    syl: ["FORT", "şrit"],
  },
  "der kompromiss": {
    ipa: "/deːɐ̯ kɔmproˈmɪs/",
    tr: "dea kom-pro-MİS",
    syl: ["kom", "pro", "MİS"],
    stress: 2,
  },
  "nachhaltig": {
    ipa: "/ˈnaːxhaltɪç/",
    tr: "NAAH-hal-tih",
    syl: ["NAAH", "hal", "tih"],
  },
  "wesentlich": {
    ipa: "/ˈveːzn̩tlɪç/",
    tr: "VEE-zınt-lih",
    syl: ["VEE", "zınt", "lih"],
  },
  "angemessen": {
    ipa: "/ˈanɡəˌmɛsn̩/",
    tr: "AN-gı-me-sın",
    syl: ["AN", "gı", "me", "sın"],
  },
  "unverzichtbar": {
    ipa: "/ˈʊnfɛɐ̯ˌtsɪçtbaːɐ̯/",
    tr: "UN-fer-tsiht-baa",
    syl: ["UN", "fer", "tsiht", "baa"],
  },
  "infolgedessen": {
    ipa: "/ɪnˈfɔlɡəˌdɛsn̩/",
    tr: "in-FOL-gı-de-sın",
    syl: ["in", "FOL", "gı", "de", "sın"],
    stress: 1,
  },
  "hingegen": {
    ipa: "/hɪnˈɡeːɡn̩/",
    tr: "hin-GEE-gın",
    syl: ["hin", "GEE", "gın"],
    stress: 1,
  },
  "berücksichtigen": {
    ipa: "/bəˈrʏkzɪçtɪɡn̩/",
    tr: "bı-RÜK-zih-ti-gın",
    syl: ["bı", "RÜK", "zih", "ti", "gın"],
    stress: 1,
  },
  "gewährleisten": {
    ipa: "/ɡəˈvɛːɐ̯ˌlaɪ̯stn̩/",
    tr: "gı-VEA-lays-tın",
    syl: ["gı", "VEA", "lays", "tın"],
    stress: 1,
  },
  "bewältigen": {
    ipa: "/bəˈvɛltɪɡn̩/",
    tr: "bı-VEL-ti-gın",
    syl: ["bı", "VEL", "ti", "gın"],
    stress: 1,
  },
  "hervorheben": {
    ipa: "/hɛɐ̯ˈfoːɐ̯ˌheːbn̩/",
    tr: "her-FOR-hee-bın",
    syl: ["her", "FOR", "hee", "bın"],
    stress: 1,
  },
  "hinterfragen": {
    ipa: "/hɪntɐˈfraːɡn̩/",
    tr: "hin-ta-FRAA-gın",
    syl: ["hin", "ta", "FRAA", "gın"],
    stress: 2,
  },
  "voraussetzen": {
    ipa: "/foˈraʊ̯sˌzɛtsn̩/",
    tr: "fo-RAUS-zet-sın",
    syl: ["fo", "RAUS", "zet", "sın"],
    stress: 1,
  },
  "einschränken": {
    ipa: "/ˈaɪ̯nˌʃrɛŋkn̩/",
    tr: "AYN-şren-kın",
    syl: ["AYN", "şren", "kın"],
  },
  "umsetzen": {
    ipa: "/ˈʊmˌzɛtsn̩/",
    tr: "UM-zet-sın",
    syl: ["UM", "zet", "sın"],
  },
  "verdeutlichen": {
    ipa: "/fɛɐ̯ˈdɔʏ̯tlɪçn̩/",
    tr: "fer-DOYT-li-hın",
    syl: ["fer", "DOYT", "li", "hın"],
    stress: 1,
  },
  "je mehr man übt, desto sicherer spricht man.": {
    ipa: "/jeː meːɐ̯ man yːpt ˈdɛsto ˈzɪçərɐ ʃprɪçt man/",
    tr: "yee mea man üüpt DES-to Zİ-hı-ra şpriht man",
    syl: ["yee", "mea", "man", "üüpt", "DES", "to", "Zİ", "hı", "ra", "şpriht", "man"],
    stress: 4,
  },

  // ---------------- C1 ----------------
  "die tragweite": {
    ipa: "/diː ˈtraːkˌvaɪ̯tə/",
    tr: "dii TRAAK-vay-tı",
    syl: ["TRAAK", "vay", "tı"],
  },
  "der paradigmenwechsel": {
    ipa: "/deːɐ̯ paraˈdɪɡmənˌvɛksl̩/",
    tr: "dea pa-ra-DİG-mın-vek-sıl",
    syl: ["pa", "ra", "DİG", "mın", "vek", "sıl"],
    stress: 2,
    note: "'chs' Almancada 'ks' olarak okunur!",
  },
  "die wechselwirkung": {
    ipa: "/diː ˈvɛksl̩ˌvɪʁkʊŋ/",
    tr: "dii VEK-sıl-vir-kung",
    syl: ["VEK", "sıl", "vir", "kung"],
    note: "'chs'->'ks', 'w'->'v'.",
  },
  "die kohärenz": {
    ipa: "/diː kohɛˈrɛnts/",
    tr: "dii ko-he-RENTS",
    syl: ["ko", "he", "RENTS"],
    stress: 2,
  },
  "die prämisse": {
    ipa: "/diː prɛˈmɪsə/",
    tr: "dii pre-Mİ-sı",
    syl: ["pre", "Mİ", "sı"],
    stress: 1,
  },
  "der konsens": {
    ipa: "/deːɐ̯ kɔnˈzɛns/",
    tr: "dea kon-ZENS",
    syl: ["kon", "ZENS"],
    stress: 1,
  },
  "die resilienz": {
    ipa: "/diː rezɪˈli̯ɛnts/",
    tr: "dii re-zil-YENTS",
    syl: ["re", "zil", "YENTS"],
    stress: 2,
  },
  "die ambivalenz": {
    ipa: "/diː ambivaˈlɛnts/",
    tr: "dii am-bi-va-LENTS",
    syl: ["am", "bi", "va", "LENTS"],
    stress: 3,
  },
  "unumgänglich": {
    ipa: "/ˈʊnʔʊmˌɡɛŋlɪç/",
    tr: "UN-um-geng-lih",
    syl: ["UN", "um", "geng", "lih"],
  },
  "tiefgreifend": {
    ipa: "/ˈtiːfˌɡraɪ̯fn̩t/",
    tr: "TİİF-gray-fınt",
    syl: ["TİİF", "gray", "fınt"],
  },
  "stichhaltig": {
    ipa: "/ˈʃtɪçhaltɪç/",
    tr: "ŞTİH-hal-tih",
    syl: ["ŞTİH", "hal", "tih"],
  },
  "differenziert": {
    ipa: "/dɪfərɛnˈtsiːɐ̯t/",
    tr: "di-fı-ren-TSİİRT",
    syl: ["di", "fı", "ren", "TSİİRT"],
    stress: 3,
  },
  "maßgeblich": {
    ipa: "/ˈmaːsˌɡeːplɪç/",
    tr: "MAAS-geep-lih",
    syl: ["MAAS", "geep", "lih"],
  },
  "nichtsdestotrotz": {
    ipa: "/nɪçtsdɛstoˈtrɔts/",
    tr: "nihts-des-to-TROTS",
    syl: ["nihts", "des", "to", "TROTS"],
    stress: 3,
  },
  "insofern": {
    ipa: "/ɪnˈzoːfɛʁn/",
    tr: "in-ZOO-fern",
    syl: ["in", "ZOO", "fern"],
    stress: 1,
  },
  "wenngleich": {
    ipa: "/vɛnˈɡlaɪ̯ç/",
    tr: "ven-GLAYH",
    syl: ["ven", "GLAYH"],
    stress: 1,
  },
  "konstatieren": {
    ipa: "/kɔnstaˈtiːrən/",
    tr: "kon-sta-Tİİ-rın",
    syl: ["kon", "sta", "Tİİ", "rın"],
    stress: 2,
  },
  "relativieren": {
    ipa: "/relatiˈviːrən/",
    tr: "re-la-ti-Vİİ-rın",
    syl: ["re", "la", "ti", "Vİİ", "rın"],
    stress: 3,
  },
  "widerlegen": {
    ipa: "/viːdɐˈleːɡn̩/",
    tr: "vii-da-LEE-gın",
    syl: ["vii", "da", "LEE", "gın"],
    stress: 2,
  },
  "einräumen": {
    ipa: "/ˈaɪ̯nˌrɔʏ̯mən/",
    tr: "AYN-roy-mın",
    syl: ["AYN", "roy", "mın"],
    note: "'äu' sesi tıpkı 'eu' gibi 'oy' okunur.",
  },
  "heranziehen": {
    ipa: "/hɛˈranˌtsiːən/",
    tr: "he-RAN-tsii-ın",
    syl: ["he", "RAN", "tsii", "ın"],
    stress: 1,
  },
  "veranschaulichen": {
    ipa: "/fɛɐ̯ˈʔanʃaʊ̯lɪçn̩/",
    tr: "fer-AN-şau-li-hın",
    syl: ["fer", "AN", "şau", "li", "hın"],
    stress: 1,
  },
  "legitimieren": {
    ipa: "/leɡitiˈmiːrən/",
    tr: "le-gi-ti-Mİİ-rın",
    syl: ["le", "gi", "ti", "Mİİ", "rın"],
    stress: 3,
  },
  "es lässt sich kaum von der hand weisen, dass bildung chancengleichheit fördert.": {
    ipa: "/ɛs lɛst zɪç kaʊ̯m fɔn deːɐ̯ hant ˈvaɪ̯zn̩ das ˈbɪldʊŋ ˈʃɑ̃ːsn̩ˌɡlaɪ̯çhaɪ̯t ˈfœʁdɐt/",
    tr: "es lest zih kaum fon dea hant VAY-zın das BİL-dung ŞAN-sın-glayh-hayt FÖR-dat",
    syl: ["es", "lest", "zih", "kaum", "fon", "dea", "hant", "VAY-zın", "das", "BİL-dung", "ŞAN-sın-glayh-hayt", "FÖR-dat"],
    stress: 7,
  },
};

export const CURATED_PRONUNCIATION_MAP = new Map<string, PronunciationGuide>();

for (const [key, seed] of Object.entries(RAW_CURATED)) {
  const cKey = canonicalWordKey(key);
  CURATED_PRONUNCIATION_MAP.set(cKey, {
    ipa: seed.ipa,
    turkishApprox: seed.tr,
    syllables: seed.syl,
    stressSyllable: seed.stress ?? 0,
    notesTr: seed.note ?? "",
    source: "curated",
    verified: true,
  });
}

export function lookupCuratedPronunciation(de: string): PronunciationGuide | null {
  const full = canonicalWordKey(de);
  if (CURATED_PRONUNCIATION_MAP.has(full)) {
    return CURATED_PRONUNCIATION_MAP.get(full)!;
  }
  const bare = full.replace(/^(?:der|die|das)\s+/u, "");
  if (bare && CURATED_PRONUNCIATION_MAP.has(bare)) {
    return CURATED_PRONUNCIATION_MAP.get(bare)!;
  }
  return null;
}

/**
 * Rule-based German -> Turkish phonetic approximation helper ONLY for unverified custom entries.
 * NEVER sets `verified: true`! Always surfaces an honest unverified label & German phonological notes.
 */
export function estimateUnverifiedPronunciation(de: string): PronunciationGuide {
  const trimmed = de.trim();
  const lower = trimmed.toLocaleLowerCase("de");
  const notes: string[] = [];

  if (/\bschw|sch/u.test(lower)) notes.push("'sch' -> 'ş'");
  if (/\b(?:sp|st)/u.test(lower)) notes.push("Başta 'sp/st' -> 'şp/şt'");
  if (/ei|ai/u.test(lower)) notes.push("'ei/ai' -> 'ay'");
  if (/eu|äu/u.test(lower)) notes.push("'eu/äu' -> 'oy'");
  if (/ie/u.test(lower)) notes.push("'ie' -> uzun 'ii'");
  if (/z/u.test(lower)) notes.push("'z' -> 'ts'");
  if (/w/u.test(lower)) notes.push("'w' -> 'v'");
  if (/[aou]ch/u.test(lower)) notes.push("Kalın ünlü sonrası 'ch' -> kalın 'h'");
  else if (/ch/u.test(lower)) notes.push("İnce ünlü sonrası 'ch' -> yumuşak 'h'");
  if (/[aäeioöuü]h/u.test(lower)) notes.push("Ünlü sonrası 'h' okunmaz, sesi uzatır");

  const tokens = trimmed.split(/\s+/u).filter(Boolean);
  const trWords = tokens.map((tok) => {
    const clean = tok.toLocaleLowerCase("de");
    if (clean === "der") return "dea";
    if (clean === "die") return "dii";
    if (clean === "das") return "das";
    if (clean === "ein") return "ayn";
    if (clean === "eine") return "AY-nı";

    let w = clean;
    w = w.replace(/^sp/gu, "şp");
    w = w.replace(/^st/gu, "şt");
    w = w.replace(/tsch/gu, "ç");
    w = w.replace(/sch/gu, "ş");
    w = w.replace(/chs/gu, "ks");
    w = w.replace(/qu/gu, "kv");
    w = w.replace(/ph/gu, "f");
    w = w.replace(/tz/gu, "ts");
    w = w.replace(/z/gu, "ts");
    w = w.replace(/ei|ai/gu, "ay");
    w = w.replace(/eu|äu/gu, "oy");
    w = w.replace(/ie/gu, "ii");
    w = w.replace(/([aouäöü])h/gu, "$1");
    w = w.replace(/eh/gu, "ee");
    w = w.replace(/ih/gu, "ii");
    w = w.replace(/oh/gu, "oo");
    w = w.replace(/uh/gu, "uu");
    w = w.replace(/ch/gu, "h");
    w = w.replace(/ß/gu, "s");
    w = w.replace(/w/gu, "v");
    w = w.replace(/j/gu, "y");
    w = w.replace(/ä/gu, "e");
    w = w.replace(/er$/u, "a");
    w = w.replace(/e$/u, "ı");
    return w;
  });

  const approx = trWords.join(" ");
  return {
    ipa: "",
    turkishApprox: approx,
    syllables: approx.split(/[\s-]+/u).filter(Boolean),
    stressSyllable: 0,
    notesTr:
      notes.length > 0
        ? `Tahmini okunuş (${notes.join(", ")}). Doğrulanmış IPA henüz eklenmedi.`
        : "Otomatik tahmini okunuş (henüz doğrulanmadı).",
    source: "estimated",
    verified: false,
  };
}

export function resolvePronunciation(
  de: string,
  dbRow?: Partial<PronunciationGuide> | null,
): PronunciationGuide {
  if (dbRow && dbRow.turkishApprox) {
    return {
      ipa: dbRow.ipa ?? "",
      turkishApprox: dbRow.turkishApprox,
      syllables: Array.isArray(dbRow.syllables) ? dbRow.syllables : [],
      stressSyllable: Number.isFinite(dbRow.stressSyllable) ? Number(dbRow.stressSyllable) : 0,
      notesTr: dbRow.notesTr ?? "",
      source: (dbRow.source as PronunciationGuide["source"]) ?? (dbRow.verified ? "curated" : "estimated"),
      verified: Boolean(dbRow.verified),
    };
  }
  const curated = lookupCuratedPronunciation(de);
  if (curated) return curated;
  return estimateUnverifiedPronunciation(de);
}
