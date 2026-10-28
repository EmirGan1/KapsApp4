# Ekran paylaşımında geri dönen konuşma sesi

Tüm sistem sesi yakalanırken KapsApp'ın uzak katılımcı sesleri de yakalanıp aynı katılımcıya geri gönderilebiliyordu.

- Sesli paylaşımda `restrictOwnAudio: {ideal:true}` istenir: paylaşımı başlatan belgenin ürettiği sesin yakalamadan dışlanması.
- Bu kısıtı desteklediğini bildirmeyen tarayıcılarda tüm sistem sesinin seçilmesi önerilmez (`systemAudio:exclude`); sekme sesi / desteklenen pencere sesi açık kalır. `windowAudio:window`, `selfBrowserSurface:exclude` ve içerik sekmesi tercihi kullanılır.
- Video kısıtlarının reddedilmesi halinde yapılan ikinci yakalama isteği aynı ses izolasyonunu korur; korumasız `audio:true` isteğine dönmez.
- Ses paylaşımı kapatılmaz; seçilen içerik kaynağının sesi ve mikrofon karışımı korunur. Aramanın bulunduğu KapsApp sekmesi paylaşım kaynağı olarak önerilmez.

Sınır: tarayıcı bu seçenekleri ipucu/kısıt olarak uygular; işletim sistemi seçim penceresi ve gerçek cihazda duyusal echo testi bu ortamda doğrulanmadı. Kendi sesini dışlayamayan tarayıcılarda tüm masaüstünün sistem sesini paylaşmak yerine içeriğin bulunduğu sekmeyi sesli paylaşmak gerekir. Aynı KapsApp belgesinde üretilen içerik sesi de own-audio dışlamasına girebilir; içerik ayrı sekmede açılmalıdır.

Kaynak: https://www.w3.org/TR/screen-capture/ (`restrictOwnAudio` ve `suppressLocalAudioPlayback` farklı amaç taşır; yerel oynatmayı susturmak geri beslemeyi çözmez).

Doğrulama: `node --import tsx --test tests/screenAudio.test.ts`; destek var/yok durumlarında içerik sesi ve kendi sesini dışlama seçenekleri, sessiz paylaşım ve güvenli video fallback'i. TypeScript ve üretim derlemesi kontrol edilir. Bu testler fiziksel hoparlör/mikrofon ölçümü değildir.
