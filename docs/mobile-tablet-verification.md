# Mobil ve tablet düzenlemesi

Değişiklikler 1024 piksel altındaki ekranları hedefler. Tabletlerde alt gezinme kullanılır. Masaüstündeki yan menü ve pencere geometrisi korunur.

- Alt gezinmenin içerik ve sohbet girişlerini örtmesini önleyen alan ayrıldı.
- Mobil pencereler görünen ekran yüksekliğiyle sınırlandırıldı; uzun içerik ve iç içe kaydırma alanları kaydırılabilir.
- Yazılım klavyesiyle görünür ekran küçüldüğünde uygulama ve pencereler uyarlanır.
- Dokunmatik yazı girişleri 16 piksel; iPhone'un odak yakınlaştırmasına neden olan küçük yazılar giderildi.
- Çentik/güvenli alan desteği ve kullanıcı yakınlaştırması korundu.

Test: `node --import tsx tests/mobile-layout.browser.ts`.
Bu paket 17 rotayı 7 ekran boyutunda (telefon/yatay telefon/tablet/masaüstü) izole bağlantı hatası durumunda açar; sayfa taşması, çalışma zamanı hataları, gezinme görünürlüğü ve mobil menüyü kontrol eder. Bu test bütün özelliklerin verili ve çevrimiçi durumlarını, gerçek cihaz davranışını veya bütün oyunları kapsamaz.

Ajandada tabletler de geniş takvim ve gün detayı çekmecesini kullanır; iki dar sütuna bölünmez. Test sonuçları: 119 rota/ekran kontrolü ve 7 ders programı/klavye senaryosu başarılı.
