# Implementation Plan - KapsStrike 3D Mobile Ergonomic HUD & Gyroscope Modernization

Sistemimizin mobil ve tablet yatay (landscape) ekranlarındaki oynanabilirliğini artırmak amacıyla, dokunmatik kontrolleri sıfırdan modernize ediyoruz. Kalabalık yapan masaüstü UI parçalarını mobilde temizleyip ergonomik, yüksek hassasiyetli dokunmatik HUD, hızlı silah seçim çarkı, jiroskopla nişan alma ve modern duraklatma (Pause) modülü ekliyoruz.

---

## 1. Mimari & Veri Yapısı Güncellemeleri

### `src/games/kapsstrike/types.ts` & `src/games/kapsstrike/config.ts`
- `StrikeSettings` arayüzüne yeni mobil ve jiroskop ayarlarını ekleyeceğiz:
  - `gyroMode: "off" | "ads" | "always"` (Jiroskop Kipleri: Kapalı, Sadece Dürbünde, Her Zaman Açık)
  - `gyroSensitivity: number` (Jiroskop Hassasiyeti, 0.1 - 3.0)
  - `showDebugStats: boolean` (Teknik FPS/Mesh/DrawCall istatistiklerini gizle/göster)
- `cleanSettings()` fonksiyonuna varsayılan jiroskop ayarlarını (`gyroMode: "ads"`, `gyroSensitivity: 1.0`, `showDebugStats: false`) ekleyeceğiz.

---

## 2. Jiroskop (Gyroscope) Entegrasyonu & Kamera Kontrolü

### `src/games/kapsstrike/controller.ts`
- Cihaz oryantasyon dinleyicisi (`window.DeviceOrientationEvent`) entegre edilecek.
- **iOS 13+ İzin Yönetimi**: `(DeviceOrientationEvent as any).requestPermission()` mekanizması, kullanıcı jiroskop ayarını açtığında güvenli bir şekilde çağrılacak.
- **Yumuşatılmış Rotasyon (Smoothing / Lerp)**:
  - Cihazın `beta` (pitch - dikey eğilme) ve `gamma` (yaw - yatay dönme) açısal değişim deltalardan yararlanarak kameranın `pitch` ve `yaw` açıları güncellenecek.
  - Jiroskop girdisi `gyroMode === "always"` durumunda veya `gyroMode === "ads"` modundayken oyuncu dürbün açtığında (`touchAdsActive === true`) devreye girecek.
- `setGyroSettings()` ve `addGyroDelta()` metodları `StrikeController` sınıfına eklenecek.

---

## 3. Ergonomik Mobil HUD & Responsive Tasarım

### `src/components/games/kapsstrike/KapsStrikeGame.tsx` & `kapsstrike.css`

#### A. Sol Başparmak Alanı (Sanal Joystick)
- Sol alt alanda dinamik/sabit, yüksek yanıt hızlı sanal analog (Virtual Joystick) yer alacak.
- Dokunulduğu noktada yumuşak haptik vuruş hissiyle yön vektörünü `controller.setTouchMovement(x, z)` fonksiyonuna iletecek.

#### B. Sağ Başparmak & Serbest Dokunmatik Dokunma Alanı (Touch Look)
- Sağ ekran yarısı serbest bakış/nişan alanı (`touch-action: none`) olarak ayrılacak.
- **Büyük Dairesel Ateş Butonu**: Sağ altta yarı saydam, basıldığında belirgin renk değiştiren ana Ateş butonu.
- **Ergonomik Yay Aksiyon Butonları**: Ateş butonunun etrafında parmak erişim mesafesine uygun dairesel yay şeklinde dizilmiş küçük şeffaf butonlar:
  - `[Zıpla]`
  - `[Çömel / Kay]`
  - `[Şarjör Yenile]`
  - `[ADS / Dürbün]`

#### C. Kompakt Tek Butonlu Silah Kartı & Hızlı Silah Çarkı
- Ekranın altını kaplayan 6 ayrı silah butonu tamamen kaldırılacak.
- Yerine aktif silahın ikonunu, adını ve kalan mermisini gösteren şık, küçük bir **Kompakt Silah Kartı** eklenecek.
- Karta dokunulduğunda yukarı doğru yelpaze/çark biçiminde açılan **Hızlı Silah Seçim Çarkı (Quick Weapon Radial Menu)** görünecek; istenen silaha dokunulduğunda otomatik kapanacak.

#### D. Üst Bar, Mikrofon & Duraklatma Paneli (Pause Modal)
- **Minimalist Üst Bar**: Sağ/sol üst köşede küçük ayarlar (dişli çark) butonu ve sol üstte küçük mikrofon durumu ikonu (`🎤`).
- **Mobil Pause Modal**:
  - `[Devam Et]`
  - `[Kamera Hassasiyeti]` Slider
  - `[Jiroskop Hassasiyeti & Kipi]` (Sadece mobil/tablet cihazlarda görünür)
  - `[Ses Düzeyi & Mikrofon Aç/Kapat]`
  - `[Lobiye / Menüye Dön]`
- **Görsel Temizlik**: FPS, draw-call, mesh sayısı gibi teknik debug bilgileri mobilde varsayılan olarak gizlenecek. `touch-action: none` ve `user-select: none` ile çimdikleme (pinch), zoom ve sürükleme tamamen engellenecek.

---

## 4. Test ve Doğrulama Adımları

1. **Derleme & Statik Tip Kontrolü**:
   - `lint_applet` (`tsc --noEmit`) çalıştırılacak.
2. **Otomatik Test Suite**:
   - `npm run test:strike` komutuyla tüm birim ve fizik testleri çalıştırılıp doğrulanacak.
3. **Applet Derleme**:
   - `compile_applet` ile Vite/React derlemesi doğrulanacak.

---

Lütfen planı inceleyip devam etmek için **Proceed** butonuna tıklayınız.
