# Kapstorial düzeltmeleri ve doğrulama

- Sunucunun haritası başlangıç seçiminden önce gönderilir; istemci rastgele bir önizlemeyi gerçek harita olarak kullanmaz. Yetkili oda üyesi tam harita ve sahiplik durumunu yeniden isteyebilir.
- Haritalar 600×400 hücredir (önceki 300×200 alanın dört katı). Beş haritanın şekilleri korunur; temel arazi iki kat örneklenir.
- Tuval oyun kabına ve piksel yoğunluğuna uyar; boyut değişiminde harita ortalanır. Sığdır düğmesi, yakınlaştırma sınırları ve dokunma iptali eklendi. Arazi piksel tamponu her animasyon karesinde yeniden hesaplanmaz.
- Kara saldırıları gerçek sınırdan başlar; uzak bölgelere sıçrama, kendi toprağına saldırı ve takım arkadaşına saldırı engellenir. Dalga kuyruğu işlenmemiş sınırları korur ve sefer sonunda kalan askerleri iade eder.
- Deniz seferi gerçek kıyıdan çıkar, suyu geçerek hedef kıyıyı bulur ve savunma maliyetini öder. Çıkarma sahiplik sayısını ve savunmacıyı günceller.
- Oyuncu kimlik çakışmaları, sıfır bot ayarı, izinsiz barış kabulü, geçersiz asker yüzdesi ve harita indeksleri düzeltildi. Etkin sefer ve emoji sayısı sınırlandı.
- Kopan bağlantılara 15 saniye geri dönüş süresi tanınır. Oda değiştirme/başlatma kontrolleri ve ücretlerin tamamının alınmasını veya işlemin geri çevrilmesini sağlayan veritabanı işlemi eklendi.
- Ücretsiz oyunların galibiyetleri de kaydedilir; aynı maçın tekrar ödüllendirilmesi engellenir.
- Başlangıç seçiminde savaş paneli gizlenir; yatay kısa ekranda paneller yanlara alınır.

## Çalıştırma

```
npm ci
npm run lint
npm run build
npm run test:kapstorial
npx playwright install chromium
npm run test:kapstorial:browser
```

Motor paketi 461 test içerir: 250 deterministik harita testi, 100 saldırı senaryosu, 50 deniz seferi, 50 oda yaşam döngüsü, beş haritada toplam 5.000 motor adımlı 10 simülasyon ve yetersiz bakiye durumunda işlem geri alma testi.

Tarayıcı paketi gerçek Socket.IO bağlantısı ve oyun bileşenlerini 390×844, 844×390, 768×1024 ve 1440×900 ekranlarda açar. Başlangıç seçiminin sunucuya ulaşmasını, harita boyutlarını, yükleme durumunu ve tarayıcı hatalarını kontrol eder. Test sunucusu, hesaplar ve veritabanı üretimden ayrıdır.

Fiziksel Android/iPhone, Safari, gerçek para/bakiye veritabanı üzerinde uçtan uca ödeme ve internet kesintili çok cihazlı maç bu ortamda doğrulanmamıştır. Bu kontroller tüm olası hataların yokluğunu kanıtlamaz.
