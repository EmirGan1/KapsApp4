# PR #10 — 1 Kasım 2026 devamı

## Kurtarılan durum

- Tek açık PR: #10, taslak; head `ca492471ffedc723e2e6f56612ef0e02f0849c50`, branch `feature/strike-tight-district`.
- Gerçek main: `1da7dacb6dda885ae1aeae2695b52fd5b6566795`. PR REST yanıtındaki base SHA `b19af98` eskiydi. Branch endpoint ve git clone aynı gerçek main SHA'sını verdi.
- Bu nedenle önceki “behind_by=0, yerelde çakışma yok” açıklaması geçerli değildi. Gerçek main ile merge-tree üç çakışma üretti: `dustDistrict.ts`, `renderer.ts`, `surfaceTextures.ts`. GitHub'ın dirty durumu gerçek bir soruna karşılık geliyordu.
- Eski head için GitHub status listesi ve check-runs boştu. “230 geçti” sonucu önceki yerel doğrulama kaydıdır; kayıtlı bir GitHub CI onayı değildir.

## Çözüm

- PR'ın radar tabanlı 3D geometrisi, yükseklikleri, collision/raycast ve bomba koordinatları korunur. Main'in alternatif düz yerleşimi bu geometriyle aynı koordinat sistemini kullanmadığı için aktif haritaya üst üste eklenmez. Kaynak commit `1da7dac` ve iki dalın tüm geçmişi korunur.
- Main'deki kamuflaj/kristal/şimşek/kozmik skin desenleri PR renderer'ına taşınır.
- Main'in prosedürel yüzeyleri Low/Medium ve uygun High fallback kaplamaları olarak alınır. PR'ın yerel 2K PBR dosyaları ve bunları yükleyen renderer kodu korunur.
- Prosedürel ince grenin koordinatlarında RNG'nin düşük bitlerinin modülünü kullanmak yerine tam aralık ölçeklemesi uygulanır; düzenli çizgi tekrarının geri gelmesi önlenir.
- Main'in A/B görüş hattı testi, her sitenin gerçek zemin yüksekliğine +1,62 m göz seviyesi ekler ve yalnız oyuncunun sığabildiği noktaları kullanır. Örnekleme 1 m aralığa sıklaştırılır; en az 500 görüş hattı zorunludur. Yeraltından çekilen ışınlar başarı kanıtı sayılmaz.

## Doğrulama

- `npm run test:strike`: **231/231**, 0 hata (64,1 saniye). Bomba, fizik, rotalar, multiplayer/socket testleri dahil.
- `npm run lint`: başarılı.
- `npm run build`: başarılı; istemci, sunucu bundle ve SEO sayfaları üretildi.
- `STRIKE_ROUTES_ONLY=1 npm run test:strike:dust3d`: iki bağımsız Chromium istemcisiyle sekiz rotanın tamamı geçti. Gerçek istemci hareket girdileri ve sunucu son konumları kullanıldı.
- `STRIKE_SCREENSHOTS_ONLY=1 STRIKE_CAPTURE_VIEWS=materials npm run test:strike:dust3d`: A/B kurma–kit ile çözme, skor/sonraki raund ve Lower Tunnels içinde H tuşuyla ateş/hasar/ölüm/skor aşamaları geçti. Bu çalıştırma daha sonraki High sahne hazırlığında 30 saniyelik timeout ile bitti; komutun bütünü başarılı olarak sunulmaz.
- Ayrı görsel çalıştırmada 66 High kaplama nesnesinin hazır ve 2048 px olduğu doğrulandı (altı yerel kaynak dosyası). Bu deneme daha sonraki kamera/snapshot beklemesinde timeout ile bitti; hata anında sunucu odasında yalnız diğer istemci vardı.
- Headless SwiftShader için yalnız test fixture'ında High readiness beklemesi 120 saniyeye, Socket.IO ping timeout 120 saniyeye çıkarıldı. Üretim bağlantı ayarları değişmedi. Son `STRIKE_CAPTURE_ONLY=1 STRIKE_CAPTURE_VIEWS=materials npm run test:strike:dust3d` tekrarı **exit 0** ile tamamlandı: High 2048 px readiness, malzeme kamerası, üstten görünüş ve istemciler kapanınca oda temizliği geçti. Malzeme/üstten görüntüler görsel olarak incelendi. Bu ayrı görsel tekrar çatışma testi sayılmaz.
- Standart `npm ci`, bu ortamda sqlite3 yerel derleme/arşiv sahipliği (`fchown EINVAL`) hatası verdi. Bağımlılıklar `npm ci --ignore-scripts` ile kuruldu. Bu doğrulama, sqlite3 kullanan tam üretim sunucusunun açılış testi değildir; oyun testleri kendi gerçek Socket.IO sunucularını kullanır.

Ham sonuç özeti: [continuation-verification.txt](continuation-verification.txt).

## Sınırlar

Bu devam, CS2 ile birebir ölçü/fotogerçekçilik veya fiziksel iOS/Android/Safari performansı onayı değildir. Önceki dokuz ekran görüntüsü eski revizyona aittir; yeni görseller gibi sunulmaz. Üretim kimlik doğrulamasında değişiklik yoktur. Main veya canlı siteye yayın yapılmaz.
