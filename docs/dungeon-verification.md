# Zindan Kuşatması doğrulama kaydı

28 Ekim 2026. Sonuçlar bu çalışma ortamında gerçekten çalıştırılan kontrollerdir; üretim sunucusu veya fiziksel cihaz sertifikasyonu değildir.

## Sonuçlar

| Kontrol | Gerçek sonuç |
|---|---|
| `npm run test:dungeon` | **1.169 geçti, 0 başarısız** |
| Tohumlu üretim | 1.000 ayrı tohum × 3 kat = **3.000 kat**; tekrar üretilebilirlik, bağlantı, çıkış, etkileşim noktaları, boss alanı |
| Motor özellik testleri | 80 adet 1.500 adıma kadar değişken yasal komut simülasyonu; can/kaynak/konum/sayı sınırları |
| Sınıf birleşimleri | 2, 3 ve 4 kişilik tüm **31 sırasız birleşim**, Kaşif zorluğunda tohum 42 ile üç katı kazanarak tamamladı |
| Zorluk/tohum değişimi | 3 zorluk × 10 tohum = **30 sefer**, kazanma veya yenilgiyle sona erdi; hepsinin kazanıldığı iddia edilmiyor |
| Ağ entegrasyonu | 6 test: gerçek Socket.IO istemcileri, lobi/yarış, oturum, yeniden katılma, gizli oda, saldırgan giriş, kalıcı kayıt ve tekrar deneme |
| `npm run test:dungeon:browser` | **4 ekran boyutu × 2 bağlı Chromium sayfası** geçti: 390×844, 844×390, 768×1024, 1440×900 |
| Tam tarayıcı seferi | İki gerçek tarayıcı oturumu yasal komutlarla üç katı kazandı. Tohum **1389248514**, **1.635 tick**, **35 düşman**, **163,9 saniye** duvar saati. İki sayfa aynı zafer ekranını gösterdi. |
| Mevcut oyun regresyonları | Kapstorial **478/478**, Battle Royale **5.026/5.026** geçti |
| TypeScript | `npm run lint` başarılı |
| Üretim derlemesi | `npm run build` başarılı |

Tarayıcı ekran testleri: oda oluşturma, kodla katılma, farklı sınıf seçimi, hazır olma, başlatma, sunucuda doğrulanan hareket, bağlantıyı kapatma/açma, tek karaktere geri dönme, rehberde kaydırma, yatay taşmama ve dokunmatik kontrollerin görünür alana sığması. Sayfa JavaScript hatası görülmedi.

Tam tarayıcı testi iki hesaplı fixture kullanır; üretim kimlik doğrulamasını değiştirmez. Test kontrolcüleri üretim 10 Hz simülasyonuna, gerçek tarayıcıların kendi soketlerinden komut gönderir. Can, hasar, hız, bekleme, kaynak veya düşman değerleri test sırasında avantaj sağlamak için değiştirilmez. Bu insanlarla manuel oyun testi değildir.

## Ölçülmüş performans

`npm run test:dungeon:performance`: 10 oda × 4 oyuncu, 1.000 toplu adım = 10.000 oda tick'i.

- On odanın bir toplu adımı: ortalama **1,78 ms**, p95 **3,39 ms**, ölçülen en yüksek **9,49 ms**.
- Hareketli durum JSON'u: ortalama **12.494 byte**, en yüksek **17.401 byte**.
- Ölçüm test kontrolcülerinin kararlarını ve periyodik JSON üretimini içerir. Ağ aktarımı, sunucu üretim yükü ve tarayıcı FPS ölçümü değildir.
- Kısa çalışmada heap değişimi görüldü; GC kontrollü çok saatlik ölçüm yapılmadığından bununla “bellek sızıntısı yok” sonucu çıkarılmaz.

## Tespit edilip düzeltilenler

1. Menzilli atışların çapraz doğrultuda bozuk ilerlemesi → başlangıç/hedef arasında tutarlı örneklenen mermi yolu.
2. Son boss'un yakın dövüş ekibine yeterli yaklaşma aralığı vermemesi → okunabilir uyarı, daha uzun toparlanma ve sınırlı ateş süresi.
3. Şifacıların çatışma dışında bekleyerek sınırsız kaynak toplaması → büyü kaynağı yenilenmesi aktif yakın çatışma veya sınırlı oda/sunak ödülüyle sınırlandı.
4. Küçük ekranda yeteneklerin görünür alanın dışında kalması → aktif sefer için tam görünür alan düzeni; yatay telefon için sıkıştırılmış HUD.
5. Dolu çantanın ganimet alımını kalıcı engellemesi → envanter eşyası bırakma.
6. Aynı hesap ikinci sekmede kontrolü sürdürebilmesi riski → tek sunucu oturumu ve eski sekmenin yetkisinin kaldırılması.
7. Zafer sonrası hemen ayrılma / kısmi veritabanı hatasında sonucun yanlış hesaplanması → sonuç uygunluğunun sabitlenmesi, idempotent yazım ve bekleyen oda kaydının korunması.
8. Eski odanın temizliğinin yeni oda üyeliğini silmesi → üyelik silme işlemi yalnızca ilgili oda koduyla eşleşirse yapılır; hızlı ayrılma/yeniden oda oluşturma testi eklendi.
9. Sunucu odası kaybolduğunda eski ekranın donmuş halde kalması → yeniden bağlantıda oda yoksa açıklamayla menüye dönüş.

## Uç durum politikası ve test kapsamı

| Şartnamedeki durumlar | Politika / kapsam |
|---|---|
| 1–10: lobi | Kapasite kontrolü aynı süreçte atomik; tekrar katılım tek karakter; host devri; sınıf değişimi hazırlığı sıfırlar; özel oda doğrulaması; aktif sefere yeni giriş yok. Ayrı başlangıç sayacı yok: hazırlık sonrası atomik başlama. Ağ testleri doğrudan kapsar. |
| 11–18: hareket | Dostlar aynı kareyi paylaşabilir; düşman/duvar engeldir. Sıçrama görüş ve hedef engelini denetler. Her komut sıra numaralı; eski komut reddedilir. BFS ve yasal komut testleri kapsar. Ayrı oyuncu dash mekaniği yoktur. |
| 19–34: savaş | Tek sunucu sıralaması, tek ölüm ödülü, ölen düşmanın uyarısının iptali, ölen büyücünün alan etkisinin durması, sınırlı iyileşme/kalkan, süre/CC sınırı, kaynak ve kat kontrolü. Çekirdek kurallar doğrudan testli; listelenen bütün zamanlama permütasyonlarının ayrı test edildiği iddia edilmez. |
| 35–44: üretim | Her tohumda bağlantı, erişilebilir nesneler ve boss odası kontrolü; anahtar kapının önünde, kapı zorunlu yolu kesmez. Üretim döngüleri sınırlıdır, oda aktivasyonu bir kez olur. 3.000 kat doğrulandı. |
| 45–56: ağ | Host devri, 60 saniye geri dönüş, aynı kimlikte tek kontrol, sıra/kat numarası, tekrar eşitleme ve eski odayı terk etme. Gerçek bağlantı kesme/yeniden bağlama testli. Kontrollü paket kaybı ve >1 saniye WAN gecikmesi enjeksiyonu yapılmadı. |
| 57–64: ganimet/kayıt | Ganimet oyuncuya ait; envanter 8; sınıf/kimlik kontrolü; tek tüketim; kayıt anahtarı run/user. Kısmi yazım hatası, yeniden deneme ve sonuçtan ayrılma doğrudan testli. |
| 65–72: boss | Ölüm evre geçişinden önce etkili; aynı tick ekip ölürse yenilgi; çağrılar sınırlı ve ana düşman bitince temizlenir. Uyarılar geçilebilir alanda; CC ve kalkan süresi sınırlı. Üç boss ve tamamlanan seferler testli; olası tüm insan konumlanmaları tüketici biçimde taranmadı. |

## Yeniden çalıştırma

```sh
npm run test:dungeon
npx playwright install chromium
npm run test:dungeon:browser
npm run test:dungeon:expedition
npm run test:dungeon:performance
npm run lint
npm run build
```

Ayrıntılı mimari, çalıştırma ve bilinen sınırlar: [dungeon-siege.md](dungeon-siege.md).
