# KapsStrike — Aşama 1

## Entegrasyon ve çalıştırma

KapsApp **Oyunlar → KapsStrike → Antrenmana Gir**; doğrudan `/oyunlar?oyun=kapsstrike`. Mevcut hesap/giriş akışının içinde kalır. Antrenman modülü sunucuya oyun isteği göndermez, sahte multiplayer/oyuncu üretmez. İkinci aşama için gerçek multiplayer henüz eklenmedi.

```sh
npm ci
npm run dev
# Üretim:
npm run build
npm start
```

Yeni çalışma zamanı bağımlılığı: `@babylonjs/core@8.50.2` (Apache-2.0). Test sürücüsü Playwright mevcut doğrulamalarda kullanılan 1.51.1 sürümüne sabitlendi. React/TypeScript/Vite ile uyumlu olduğundan istenen Babylon.js kullanıldı. Havok veya ek fizik bağımlılığı yerine sunucuya taşınabilen sayısal hareket/çarpışma modülü yazıldı. Yeni ortam değişkeni, DB migration veya arka uç servisi yoktur. Kamera/mikrofon/ekran paylaşımı kodu değiştirilmedi.

Babylon ve oyunun CSS'i oyun açıldığında lazy chunk olarak yüklenir. Diğer oyunların ilk yüklemesine 3D motor eklenmez. KapsStrike'a ait hata sınırı, başarısız bir oyun yüklemesinin KapsApp'ın geri kalanını kapatmasını önler.

## Oyun kuralları

- 120 Hz sabit adım; kontrollü hızlanma, zemin sürtünmesi, hava kontrolü, yerçekimi ve zıplama. Space bırakılıp yeniden basılmalıdır; tutulunca sınırsız otomatik hop oluşmaz. Yatay hız 13 m/s ile sınırlı.
- Ayakta 1,80 m / çömelme 1,12 m kapsül. Kutu çarpışmasında dairesel kesit + kapsül uçları; rampalarda eğim yüzeyi/zemin yüksekliği. Çömelirken alçak tavan altında ayağa kalkılamaz. Küçük alt adımlar ince duvardan geçmeyi sınırlar. Basamak yüksekliği 0,32 m.
- Koşarken çömelme momentumu koruyan, süreli slide başlatır. Çömelme, slide ve ayakta kamera yükseklikleri farklıdır.
- Beş silah: AR-30 Yörünge, SM-35 Kıvılcım, SR-5 Ufuk, SG-6 Yarma, P-12 İz. İstenen 30/35/5/6/12 şarjör ve 25/18/90/80/28 temel hasar, 600/850/50/75/360 RPM başlangıç değerleri merkezi yapılandırmada. Shotgun 80 hasarı sekiz ayrı saçmaya dağıtır. Mesafe düşüşü ve 2× kafa katsayısı uygulanır.
- Otomatik AR/SMG; yeniden basma gerektiren pistol/sniper/shotgun. Sniper ve pompalı döngüleri ateş aralığıyla kilitlenir. Silah değişim gecikmesi, reload iptali/değişimi, reload sırasında ateş engeli ve şarjör sınırları vardır. Antrenmanda yedek mühimmat sınırsız, şarjör sonludur.
- Hitscan çizgileri gerçek kutu/rampa geometrisinde durur. Rampa ışını sadece eğimli kama içinde kesişir; rampanın üstündeki boş hacim dolu kutu sayılmaz. Kafa/gövde hitbox ölçüleri görsel ve savaş modülünde aynı tanımdan alınır.
- ADS FOV/spread, recoil, özgün geometrik viewmodel, muzzle flash, reload hareketi, vuruş/hasar işaretleri, mermi çizgileri ve impact efektleri. 48 tracer + 48 impact mesh'i tekrar kullanılır. 16 eşzamanlı sentezlenmiş ses sınırı vardır; tek ses her atışta başa sarılmaz.
- Kamera silahı ayrı derinlik grubunda çizer; duvara yakınken viewmodel geri/yan yatırılır. Bu, yakın duvar clipping'ini azaltır; silah dünya içinde fiziksel bir katı cisim değildir.
- 100 can, ölüm, 2 saniye sonra respawn, 2 saniye spawn koruması. Tehlike alanı kırmızı zemindir. İsteğe bağlı kukla karşı ateşi görüş hattı denetler; yerel antrenman mekaniğidir.
- Beş kukla, biri hareketli. Ölen hedef 3 saniye sonra geri gelir. Hareketli hedef katı geometri içine ilerlemez. Skor, birikmiş gerçek hasar, kafa bildirimi ve ilk vuruştan geçen simülasyon süresine göre DPS gösterilir.

## Haritalar

Üçü de aynı hareket/savaş kodunu çalıştırır; sadece menü dekoru değildir. Her harita 76×76 m dış alan, on geçerli spawn, beş hedef, siperler ve erişilebilir tehlike alanı içerir.

| Harita | Mimari ve rotalar |
|---|---|
| Warehouse / Aktarma 07 | Konteyner sıraları, endüstriyel duvarlar/direkler, yükleme platformu, servis merdiveni ve rampa; yakın koridorlar ile merkez/yan yollar |
| Dust Town / Sarı Geçit | Kapılı/pencereli binalar, sokaklar, kemerli siper, çatı platformu, rampa ve merdiven; orta/uzun görüş hatları |
| Neon Arena / Prizma | Farklı yüksekliklerde yan platformlar, üst köprü, merkez ve yan rampalar, ışıklı düşük poligonlu siperler; dikey rotalar |

Harita, silah ve ses varlıkları kodla üretilmiş özgün içeriktir; Krunker haritası/modeli veya telifli dış asset kopyalanmadı.

## Kontroller / ayarlar

WASD hareket, fare bakış, Space zıplama, Shift koşma, Ctrl/C çömelme-slide, sol tık ateş, sağ tık ADS, R reload, 1–5/tekerlek silah, ESC duraklat/fareyi bırak. Ayarlanabilir grafik Low/Medium/High, çözünürlük ölçeği 0,5–1,5, hassasiyet, FOV 65–115, ses ve dikey eksen ters çevirme. Ayarlar yeni antrenmanda uygulanır ve yerel olarak saklanır.

Oyun sırasında sayfa scroll/metin seçimi engellenir; olaylar aktif fare kilitli canvas ile sınırlıdır. ESC, odak kaybı, arka plan sekmesi veya uygulamada oyun sekmesinin gizlenmesi simülasyon/render'ı durdurur. Çıkışta listener'lar, pointer lock, resize observer, audio context, Babylon sahnesi ve engine bırakılır. Yeni sahne kurulum hatasında kısmi engine de temizlenir.

HUD: crosshair, hitmarker/headshot ve birleştirilmiş shotgun hasarı, can/koruma, cephane/reload, süre/skor/DPS, hareket hızı/stance, FPS/drawcall/aktif mesh. Ping uydurulmaz: “Yerel antrenman, bağlantı yok”.

Dokunmatik FPS kontrolü bu aşamada yoktur. Menü responsive'dir; oynanış klavye/fare, WebGL ve pointer lock destekli masaüstü tarayıcı içindir.

## Modül sınırları — Aşama 2

| Dosya | Sorumluluk |
|---|---|
| `src/games/kapsstrike/types.ts` | Sayısal input, movement, player, weapon, dummy ve combat event veri yapıları |
| `config.ts` | Hareket/silah/ADS/recoil/ayar/hitbox sabitleri |
| `maps.ts` | Ortak spawn, katı geometri, hedef ve hazard tanımları |
| `physics.ts` | Browser/Babylon gerektirmeyen kapsül hareketi, destek yüzeyi, ray/katı kesişimi |
| `combat.ts` | Browser/Babylon gerektirmeyen simülasyon, cadence, cephane, hasar, respawn ve olay üretimi |
| `controller.ts` | Yerel cihaz girdileri, sabit adım zamanlayıcı, pointer lock ve HUD snapshot'ları |
| `renderer.ts` | Babylon scene/camera, instancing, frustum culling, viewmodel, pool ve dispose |
| `audio.ts` | Sınırlı, özgün Web Audio sesleri ve dispose |
| `src/components/games/kapsstrike/KapsStrikeGame.tsx` | React menü, ayarlar, kontroller ve HUD |
| `kapsstrike.css` | Oyuna kapsamlanmış görünüm |
| `StrikeBoundary.tsx` | Oyuna özel yükleme/render hata sınırı |
| `src/components/Games.tsx` | Ayrı kart, doğrudan giriş parametresi ve lazy import |
| `package.json`, `package-lock.json` | Babylon bağımlılığı, tekrarlanabilir kurulum, test komutları |
| `tests/kapsstrike.*` | Motor, sahne, controller ve tarayıcı/menü doğrulamaları |

Input komutunda sıra numarası ve tick bulunur. Eski/tekrarlı, yanlış tick veya sayısal olmayan komut reddedilir. Yerel antrenman oyuncusunun benzersiz ID'si vardır; respawn bu ID'yi korur. `simulate`/`move`/silah kuralları render'dan ayrı olduğundan server-authoritative simülasyon ve client prediction için kullanılabilir. Ağ transport'u, odalar, reconciliation, lag compensation ve uzak oyuncular **henüz yoktur**; ikinci aşamadır. İstemcinin söylediği isabet/hasarı kabul eden sahte bir ağ yolu eklenmedi.

## Performans sınırları

Sabit adım catch-up 8 adımla sınırlıdır; sekme dönüşünde biriken sürenin tek kareye yüklenmesi önlenir. HUD 10 Hz güncellenir. Aynı boyut/materyaldeki kutular instance kullanır; materyaller paylaşılır/dondurulur. Low gölgesiz; High 1024 shadow map kullanır. Render çözünürlüğü kalite/DPR/ölçekle sınırlandırılır. Bunlar ölçülmüş fiziksel GPU'da 60+ FPS garantisi değildir.

## Test sonuçları

Ayrıntılı çalıştırma kayıtları ve sınırlar: [KapsStrike doğrulama raporu](kapsstrike-verification.md).
