# KSGO checkpoint — 7 Kasım 2026

## Amaç ve durma nedeni

Kullanıcı kullanım limitini korumak için güvenli checkpoint istedi. Yeni geliştirmeye devam etmeyin; bu belge ve branch üzerinden kaldığınız yerden sürdürün. Dosyaları sıfırlamayın veya yeniden üretmeyin.

- Repo: `EmirGan1/KapsApp4`
- Branch: `perf/strike-auto-reload-latency`
- Yerel konum: `/workspace/scratch/b419b9ad0a5e/kapsapp4`
- Güncel taban: `f476b26acd5a4e21342237e7ee82fbc80ac2dacc`
- İlk uygulama commit'i (rebase sonrası): `582bf04`.
- Bu belge, son testler ve ek son-mermi regresyonu sonraki checkpoint commit'inde. Kesin son SHA'yı `git log -1` veya PR başlığından alın.
- Checkpoint hazırlanırken bu branch'e ait açık PR yoktu. GitHub aktarımı ve varsa yeni taslak PR sonucu son kullanıcı yanıtında belirtilir. Merge veya deployment yapılmadı.

## İstekler ve tamamlanan kod

1. Şarjör bitince otomatik doldurma: `reload.ts` istemci ve sunucu için ortak zamanlama sağlar; boş şarjör ve son kabul edilen atış sonrası başlar. Manuel doldurma, silah değiştirme gecikmesi ve dondurulmuş bomba turu kontrolleri korunur. Bıçak doldurmaz. Son atış komutu `reload=true` diye değiştirilmez: aksi halde sunucu son mermiyi ateşlemeden doldurmaya başlayabiliyordu. Bunun için özel istemci/sunucu eşleşme testi var.
2. Kaliteyi azaltmadan CPU yükünü düşürme: 8 metrelik X/Z hücrelerinde kapsül yarıçapıyla genişletilmiş çarpışma indeksi. Yakın adaylar sorgulanır; mevcut kapsül, rampa, destek denklemleri aynıdır. Harita geometrisi, doku, ışık ve kalite presetleri bu değişiklikte azaltılmadı. İndeks statik geometri varsayar; solid dizisi değişince veya uzunluğu değişince yenilenir.
3. Sunucu: mevcut ortak snapshot tabanı korunur; aynı dünya durumunun alıcı başına tekrar kopyalanması kaldırılır. Özel oyuncu durumu ve bomba görünümü alıcıya özeldir. Bot/bağlantısı kopmuş oyuncuya snapshot gönderilmez. Sunucu polling 60 → 120 Hz, fizik zaten 120 Hz; snapshot 30 Hz ve güvenilir aktarım korunur. Bu internet mesafesini/ping RTT'sini azaltmaz; işlem beklemesi ve CPU yüküne yöneliktir.
4. Skinler: 144 yeni, benzersiz atlas; sekiz ateşli silahın ve dört bıçak modelinin her birine 12 yeni kaplama. Toplam **267 skin**. 12 yeni motif, model bazlı yön/desen imzası; mevcut envanter ve oyun içi ortak kaplama yolu kullanılır. Önceki skin ID'leri/oyuncu sahipliği değiştirilmedi.
5. Kasalar: Prizma, Sakura, Hükümdar ile toplam **9 kasa**. Yeni kasalar ilk açılış ücretsiz, sonrası 400 kredi. 40/30/20/5/5 nadirlik oranları korunur. Yeni ödüller karma silah havuzlarına dağıtılır; her skin en az bir kasadan çıkar. Mevcut kasa arayüzü CASES listesini otomatik gösterir.

## Çalışma sırasında gelen upstream değişiklikler

İlk taban `d30cf1a` iken ana dala `dd98369` (otomatik reload/render/state optimizasyonu), `f9856c5` (harita mimarisi), `f476b26` (sesli görüşme/mahremiyet) geldi. Branch bunların üzerine rebase edildi. Çakışmalar `combat.ts` ve `kapsstrikeServer.ts` içinde çözüldü. Yeni harita ve WebRTC değişiklikleri korunuyor. Upstream `shouldAutoReload` dışa aktarımı/controller kullanımı ve özel state clone fonksiyonları korundu. Yeni upstream son-atış paketini reload'a çeviriyordu; bu davranış düzeltilip ilgili features testi güncellendi. Upstream renderer optimizasyonları bu PR'ın kendi değişikliği olarak gösterilmemeli.

## Son test durumu

Güncel `f476b26` tabanı üzerinde checkpoint öncesi:

- `npm run lint`: geçti.
- `npm run build`: geçti. Vite büyük chunk uyarısı var, derleme hatası değil.
- Aşağıdaki komut: **1175 / 1175 geçti**, hata yok:

```sh
node --import tsx --test tests/kapsstrike.optimization.test.ts tests/kapsstrike.inventory.test.ts tests/kapsstrike.progression.test.ts tests/kapsstrike.hitreg.test.ts tests/kapsstrike.features.test.ts tests/kapsstrike.audit1000.test.ts tests/kapsstrike.4v4.test.ts
```

- Yeni optimization testi 18 senaryo: tüm haritalarda orijinal tam taramayla çarpışma eşitliği (harita başına 5000 rastgele nokta, solid kenarları/rampalar, iki duruş), cache geçersizleşmesi, reload zamanlaması, dondurulmuş başlangıç, son mermi istemci/sunucu eşitliği, snapshot özel durum ayrımı, 144 atlasın benzersizliği, 267 katalog ve dokuz kasa ekonomi/olasılık sınırları.
- Rebase öncesi ayrıca Babylon sahne testleri, gerçek 8/10 Socket.IO istemcisi jitter/yeniden bağlantı testleri geçti. Gerçek 4v4 ağ testinde A/B kurma/çözme/yeni tur/yeniden bağlanma geçti. Bunlar **yeni upstream harita değişiklikleri sonrası tekrar çalıştırılmadı**; CI/sonraki aşamada çalıştırın.
- Yerel Chromium görsel testi **çalıştırılamadı**: host Chromium process-singleton `socket()` çağrısını `Operation not permitted` ile engelliyor. Bu bir uygulama assertion hatası değil. Yetki yükseltmeyle aşılmaya çalışılmadı. Tam Chromium indirildi, ffmpeg/headless-shell kurulumu da ayrıca indirme hatası verdi. Browser testinde `STRIKE_CHROMIUM` ile isteğe bağlı executable yolu var.
- GitHub workflow'a 267 skinin gerçek doku yükleme/eşleşme ve medium/high render testi eklendi; checkpoint anında uzaktaki CI sonucu henüz alınmadı. Yerel test geçmişini tamamen yeşil genel suite olarak sunmayın. Önceki görevde `world.test.ts` içinde 11 eski hata vardı; bu turdaki tam suite kapsamına alınmadı, yeni tabanda durumları yeniden doğrulanmadı.

## Ölçümler

`docs/strike-auto-reload-performance.md` güncel tabanla tekrar ölçülen sonuçları ve yeniden üretme komutlarını içerir. Sekiz istemcili loopback testinde giriş işleme beklemesi medyanı 19.043 → 4.425 ms; simülasyon adımı medyanı 12.009 → 0.448 ms. Baseline bu testte gerçek zamandan geri kaldığı için snapshot onay farkı ayrıca backlog içerir. Bunlar üretim ping/FPS garantisi değildir. Yeni main haritası kullanılarak collision checksum'ları eşleşti. Ölçümler tek makinede tanısaldır; oyun içi FPS karşılaştırması yapılmadı.

## Değiştirilen dosyalar (main'e göre)

| Dosya | Değişiklik |
|---|---|
| `src/games/kapsstrike/reload.ts` | Ortak reload zamanlaması |
| `src/games/kapsstrike/combat.ts` | Ortak helper; son atış paketini değiştirmeden reload |
| `src/games/kapsstrike/physics.ts` | Hücre bazlı çarpışma aday indeksi |
| `src/server/kapsstrikeServer.ts` | Ortak reload, 120 Hz polling, ortak world snapshot |
| `src/games/kapsstrike/cosmetics.ts` | 144 kaplama, üç kasa, ödül grupları |
| `src/games/kapsstrike/finishAppearance.ts` | 12 yeni motif ve modele özgü atlas |
| `src/games/kapsstrike/economy.ts` | Yeni kasaların fiyatları |
| `tests/kapsstrike.optimization.test.ts` | Yeni regresyonlar |
| `tests/kapsstrike.features.test.ts` | Son mermi paketinin değişmediği beklentisi |
| `tests/kapsstrike.hitreg.test.ts` | Otomatik doldurma boyunca doğru mermi hesabı |
| `tests/kapsstrike.inventory.test.ts` | Silah başına 24 toplam skin, dokuz kasa |
| `tests/kapsstrike.progression.test.ts` | Kasa sayısına göre ücretsiz açılış/sayaç beklentileri |
| `tests/kapsstrike.finish.browser.ts` | Tüm atlaslar + medium/high yeni altın skin görüntüsü |
| `tests/kapsstrike.performance.measure.ts` | Tekrarlanabilir CPU/snapshot ölçümü |
| `tests/kapsstrike.latency.measure.ts` | Sekiz istemcili işlem/ack gecikmesi ölçümü |
| `.github/workflows/dust-bomb-audit.yml` | Yeni regresyon ve skin WebGL kontrolü |
| `docs/strike-auto-reload-performance.md` | Uygulama, ölçüm ve sınırlar |
| `docs/strike-checkpoint-2026-11-07.md` | Bu devir özeti |

## Sonraki adımlar — önce doğrulama

1. Son remote branch/PR ve commit'i kontrol edin; ana dal yeniden ilerlemişse kullanıcı değişikliklerini koruyun. Mevcut uygulamayı yeniden oluşturmayın.
2. Taslak PR için GitHub Actions sonuçlarını okuyun. Hata varsa ilgili adıma odaklanın; geçen tüm testleri tekrar tekrar çalıştırmayın.
3. Chromium destekleyen runner'da `tests/kapsstrike.finish.browser.ts` çalışmalı: 267 atlas yüklenmeli, envanter URL'siyle eşleşmeli, medium/high altın kaplama ekran görüntüleri incelenmeli. Kasaların mobil/masaüstü görünümünü de doğrulayın.
4. Güncel harita üzerinde `npm run test:strike:4v4:network`, mevcut Dust A boşluk browser regresyonu, bomb/spectator browser akışlarını tamamlayın (workflow zaten bunları kapsıyor).
5. Manuel iki istemciyle son mermi → reload → tekrar ateş, manuel R, silah değiştirme, ölüm/respawn ve tur geçişlerini doğrulayın. 120 Hz timer'ın çok odalı üretim yükünde etkisini ölçün; gerçek GPU üzerinde orta/yüksek FPS ölçümü hâlâ eksik.
6. Yeni skinlerden her bıçak tipi ve silahı görsel inceleyin; karambit/kelebek geometrisi ve animasyonu bu çalışmada değiştirilmedi. 144 benzersiz atlas olması estetik görsel onayın yerine geçmez.
7. Sonuçlar iyiyse PR açıklamasını tamamlayıp hazır duruma getirin; kullanıcı istemeden main'e merge/deploy etmeyin.

Yerel geçici günlükler `/tmp/strike-checkpoint-{lint,tests,build}.log`; ölçümler `/tmp/strike-final-{before,after}.json` ve `/tmp/strike-final-latency-{before,after}.json`. Bu dosyalar geçicidir; esas ölçüm bilgisi repodaki belgede kalıcıdır. `/tmp/strike-perf-base` yalnızca karşılaştırma worktree'sidir, çalışmanın asıl branch'i değildir.
