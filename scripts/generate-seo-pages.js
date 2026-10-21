import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

// SEO Rotaları, Başlıklar, Açıklamalar ve Canonical Bağlantılar Yapılandırması
const routes = [
  {
    path: 'dersler',
    title: 'Ders Klasörleri & IB Materyalleri | KapsApp',
    description: 'IB Matematik, Fizik ve tüm dersler için geçmiş yıl soru kağıtları (Past Papers), Mark Scheme çözümleri ve çalışma notları.',
    canonical: 'https://kapsapp.online/dersler'
  },
  {
    path: 'ajanda',
    title: 'Ajanda & Sınav Takvimi | KapsApp',
    description: 'Günlük ders programı, HL ve SL seviyelerine göre mock sınav saatleri ve ders araları çizelgesi.',
    canonical: 'https://kapsapp.online/ajanda'
  },
  {
    path: 'genel-sohbet',
    title: 'Genel Sohbet & Mesajlaşma | KapsApp',
    description: 'Öğrenciler arası anlık mesajlaşma, soru paylaşımı ve etkileşimli sohbet kanalları.',
    canonical: 'https://kapsapp.online/genel-sohbet'
  },
  {
    path: 'sesli-sohbet',
    title: 'Sesli & Görüntülü Sohbet Odaları | KapsApp',
    description: 'Birlikte ders çalışma, ekran paylaşımı ve düşük gecikmeli sesli iletişim kanalları.',
    canonical: 'https://kapsapp.online/sesli-sohbet'
  },
  {
    path: 'hava-durumu',
    title: 'Kampüs Canlı Hava Durumu | KapsApp',
    description: 'Kampüs bölgesi için anlık sıcaklık, rüzgar ve saatlik hava durumu tahminleri.',
    canonical: 'https://kapsapp.online/hava-durumu'
  },
  {
    path: 'duyurular',
    title: 'Okul & Platform Duyuruları | KapsApp',
    description: 'Sınav duyuruları, etkinlikler ve yönetim bilgilendirmeleri.',
    canonical: 'https://kapsapp.online/duyurular'
  },
  {
    path: 'ib-hesaplayici',
    title: 'KapsCulator - IB Diploma ve Puan Hesaplayıcı | KapsApp',
    description: 'KapsApp KapsCulator - IB Diploma puan hesaplama aracı. Turkish A, English B, TITC, Math AA, Physics ve Digital Society sınav, IA ve diploma simülatörü.',
    canonical: 'https://kapsapp.online/ib-hesaplayici'
  }
];

function generatePages() {
  const baseHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(baseHtmlPath)) {
    console.error('Hata: dist/index.html bulunamadı! Önce build alınmalıdır.');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(baseHtmlPath, 'utf8');

  routes.forEach(route => {
    const routeDir = path.join(distDir, route.path);
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }

    let customHtml = baseHtml;

    // 1. Title Değiştirme
    customHtml = customHtml.replace(/<title>.*?<\/title>/i, `<title>${route.title}</title>`);

    // 2. Meta Description Değiştirme (Yoksa Ekle)
    if (customHtml.includes('<meta name="description"')) {
      customHtml = customHtml.replace(
        /<meta name="description" content=".*?"\s*\/?>/i,
        `<meta name="description" content="${route.description}" />`
      );
    } else {
      customHtml = customHtml.replace('</head>', `  <meta name="description" content="${route.description}" />\n</head>`);
    }

    // 3. Canonical Tag Değiştirme (Yoksa Ekle)
    if (customHtml.includes('<link rel="canonical"')) {
      customHtml = customHtml.replace(
        /<link rel="canonical" href=".*?"\s*\/?>/i,
        `<link rel="canonical" href="${route.canonical}" />`
      );
    } else {
      customHtml = customHtml.replace('</head>', `  <link rel="canonical" href="${route.canonical}" />\n</head>`);
    }

    // 4. OpenGraph & Twitter Etiketleri Ekle/Güncelle
    if (customHtml.includes('<meta property="og:title"')) {
      customHtml = customHtml.replace(/<meta property="og:title" content=".*?"\s*\/?>/i, `<meta property="og:title" content="${route.title}" />`);
    } else {
      customHtml = customHtml.replace('</head>', `  <meta property="og:title" content="${route.title}" />\n</head>`);
    }

    if (customHtml.includes('<meta property="og:description"')) {
      customHtml = customHtml.replace(/<meta property="og:description" content=".*?"\s*\/?>/i, `<meta property="og:description" content="${route.description}" />`);
    } else {
      customHtml = customHtml.replace('</head>', `  <meta property="og:description" content="${route.description}" />\n</head>`);
    }

    if (customHtml.includes('<meta property="og:url"')) {
      customHtml = customHtml.replace(/<meta property="og:url" content=".*?"\s*\/?>/i, `<meta property="og:url" content="${route.canonical}" />`);
    } else {
      customHtml = customHtml.replace('</head>', `  <meta property="og:url" content="${route.canonical}" />\n</head>`);
    }

    if (customHtml.includes('<meta name="twitter:title"')) {
      customHtml = customHtml.replace(/<meta name="twitter:title" content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${route.title}" />`);
    }

    if (customHtml.includes('<meta name="twitter:description"')) {
      customHtml = customHtml.replace(/<meta name="twitter:description" content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${route.description}" />`);
    }

    const destPath = path.join(routeDir, 'index.html');
    fs.writeFileSync(destPath, customHtml, 'utf8');
    console.log(`[SEO-GEN] Üretildi: ${route.path}/index.html`);
  });

  console.log('[SEO-GEN] Tüm alt rotalar başarıyla statik HTML olarak derlendi.');
}

generatePages();
