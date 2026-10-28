# Görüntülü / sesli sohbet ve ekran paylaşımı düzeltmeleri

- Kamera ve ekran ayrı RTP göndericileridir. Ekran yenileme, ön plana dönme, kamera kapatma/açma yolları artık ilk video göndericisini rastgele seçmez.
- Ekran akış kimliği SDP teklif/yanıtıyla açıkça iletilir; karşı tarafta ekran ile kamera ayrı MediaStream anahtarlarına yerleştirilir. İz etiketi tarayıcılar arasında güvenilir kimlik değildir.
- Ekran paylaşımındaki kamera şeridi kamera olarak gösterilir. Paylaşım açmak, kapalı kamerayı otomatik açmaz.
- Her bağlantı 3 saniyede bir getStats ile değerlendirilir: kullanılabilir gönderim bant genişliği, RTT, uzak alıcının kayıp oranı. Video bütçesi her alıcı için farklıdır; ekran varken kamerayla paylaşılır. Kötü bağlantıda çözünürlük, FPS ve bit hızı düşer; iyileşme üç sağlıklı ölçüm bekler. Ses 96 kbps üst sınır ve yüksek RTP önceliğiyle korunur.
- Küçük odalarda otomatik kamera yakalama 1080p hedefler; cihaz ve internet destekledikçe gönderilir. Ekran yakalama 30 FPS hedefler; metin ayrıntısı ipucu korunur. Sabit 60 FPS / 5 Mbps ekran yükü kaldırıldı.
- Mikrofonun doğal gürültü bastırması kullanıcı tercihine göre etkinleştirilir. Mikrofon + sistem sesi karışımı dinamik kompresörden geçer; yüksek toplam seviyelerde kırpılma riski azaltılır.
- Aynı anda gelen SDP teklifleri için deterministik polite/rollback davranışı; eski yanıtların yanlış sinyal durumunda uygulanması engellenir.

## Doğrulama

- 49 otomatik ağ bütçesi / kalite geri kazanımı testi geçti.
- TypeScript ve üretim derlemesi geçti.
- İki Chromium sayfasında gerçek RTCPeerConnection ve mevcut useWebRTC hook'u: kamera + ekranın ayrı alınması, paylaşım sırasında kamera kapatma/açma, paylaşımı durdurup yeniden başlatırken kameranın korunması test edildi. Kamera/mikrofon sanal test cihazı, ekran canvas kaynağıdır; işletim sistemi seçim penceresi değildir.
- Fiziksel cihaz, Safari, gerçek kötü WAN bağlantısı, işletim sistemi ekran/sistem sesi seçimi ve canlı dağıtım doğrulanmadı. Otomatik bütçe testleri fiziksel ağ koşulu testi olarak sunulmaz.

## Çalıştırma

`node --import tsx --test tests/rtcAdaptation.test.ts`

`npx playwright install chromium`

`node --import tsx tests/rtc.browser.ts`

Oda mevcut WebRTC mesh mimarisini kullanır; medya sunucudan aktarılmaz. Sunucuya daha çok CPU/RAM vermek kullanıcıların yükleme hızını artırmaz. Bu değişiklik bağlantı başına uyarlama ve ses önceliği sağlar; çok kalabalık odalar için SFU ayrı altyapı çalışması gerektirir.
