# Ekran paylaşımı ve kamera yükü

## Değişiklikler

- Ekran yakalama 1920×1080, 60 FPS hedefler. Önceki 4K üst sınır yerine 1080p üst sınır, eşzamanlı kamera sırasında piksel/kodlama yükünü sınırlar. 60 üzeri FPS bu sürümün hedefi değildir.
- Kamera ve ekran FPS'leri ayrıdır: sağlıklı bağlantıda ekran 60, kamera 30 FPS hedefler. Yavaş ağda ekran 15/30 FPS'e düşebilir. Gerçek FPS kaynak, ekran yenilemesi, tarayıcı, cihaz ve ağ tarafından belirlenir.
- Paylaşım boyunca kamera yakalama 720p/30 üst sınırına alınır; küçük kamera kutusu için ikinci 1080p kodlama maliyeti azaltılır. Paylaşım bitince seçili kamera ayarı geri uygulanır.
- WebRTC `qualityLimitationReason: cpu` raporlarsa çözünürlük küçültülür, ekran 30/kamera 20 FPS sınırına alınır. Bu, cihaz kodlamaya yetişmiyorken zorla 60 FPS isteyerek tüm aramayı kilitlememek içindir.
- Ekran videosu hareket odaklı içerik ipucuyla ve FPS'i koruyan degradation tercihiyle gönderilir. Sesin yüksek önceliği korunur.
- Toplam video üst bütçesi bağlantı sayısına bölünen 12 Mbps'tir; gerçek bağlantı ölçümü daha düşükse bu değer kullanılmaz. İnternet toparlanmasında kalite yükselişi için üç sağlıklı ölçüm beklenir.
- Video encoder parametreleri değişmedikçe yeniden uygulanmaz.
- Ekran sesinin Web Audio karıştırıcı düğümleri paylaşım durduğunda/odadan çıkıldığında ayrılır; tekrar paylaşımda eski mikrofon grafiklerinin çalışması önlenir.

## Doğrulama

`node --import tsx --test tests/rtcAdaptation.test.ts tests/screenAudio.test.ts`: 55 test geçti. Sağlıklı bağlantıda ayrı 60/30 FPS hedefi, CPU kısıtında düşüş, bant bütçeleri, yükseliş gecikmesi ve ses izolasyonu/fallback dahil.

`npm run lint` ve `npm run build` başarılı.

`node --import tsx tests/rtc.browser.ts`: iki gerçek Chromium WebRTC bağlantısında kamera + ekran ayrımı, paylaşım sırasında kamera kapatma/açma ve paylaşımı yeniden başlatma kontrolü. Test kaynakları sanaldır; fiziksel cihazda alınan FPS veya canlı kapsapp.online performans ölçümü değildir.

Sınır: mevcut mimari WebRTC mesh'tir. Her uzak katılımcı için kodlama/gönderim gerekir; sunucu RAM/CPU'sunu artırmak istemci encoder'ını veya kullanıcının internetini büyütmez. Fiziksel cihaz ve kalabalık gerçek oda altında takılmasız 60 FPS garantisi verilmez. Çok kalabalık odalarda SFU medya sunucusu ayrı altyapı değişikliğidir.
