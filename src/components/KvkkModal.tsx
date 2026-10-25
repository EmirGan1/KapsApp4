import React from 'react';
import { ShieldCheck, X, CheckCircle2 } from 'lucide-react';

interface KvkkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export default function KvkkModal({
  isOpen,
  onClose,
  onAccept,
  showAcceptButton = false
}: KvkkModalProps) {
  if (!isOpen) return null;

  return (
    <div className="mobile-window fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg">
                KapsApp KVKK, Gizlilik ve Yasal Uyarı Metni
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                6698 Sayılı Kişisel Verilerin Korunması Kanunu, 5651 Sayılı Kanun ve Yasal Sorumluluk Çerçevesi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">1. Veri Sorumlusu, Kapsam ve Hizmet Kanalları</h4>
            <p>
              İşbu Aydınlatma, Gizlilik ve Yasal Uyarı Metni; 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK"), 5651 sayılı "İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun" ve ilgili mevzuat uyarınca Veri Sorumlusu sıfatıyla KapsApp ("Platform") tarafından işletilen web sitesi (kapsapp.online), mobil uygulamalar (Capacitor altyapısı) ve platforma entegre tüm iletişim, canlı harita, sosyal ağ, eğitim/etüt ve oyun simülasyonu servislerini kullanan kişilerin kişisel verilerinin işlenme amaçlarını, hukuki sebeplerini, aktarım süreçlerini ve yasal haklarını açıklamaktadır.
            </p>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">2. İşlenen Kişisel Veri Kategorileri ve Hukuki Sebepleri (KVKK Madde 5)</h4>
            <p>Platformumuz kapsamında işlenen kişisel veriler ve dayandığı hukuki sebepler aşağıda detaylandırılmıştır:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-1">
              <li><strong>Kimlik ve Hesap Verileri:</strong> (Kullanıcı adı, e-posta adresi, bcrypt algoritmasıyla tuzaklanmış şifre özeti, profil rengi, avatar görseli, biyografi ve kullanıcı rolleri): KVKK Md. 5/2-c uyarınca "Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması" hukuki sebebine dayanarak üyelik, kimlik doğrulama ve kullanıcı profili yönetimi amacıyla işlenir.</li>
              <li><strong>Trafik, Erişim ve Oturum Logları:</strong> (IP adresi, port bilgisi, kullanıcı-aracı/User-Agent bilgisi, giriş/kayıt/çıkış zaman damgaları, HTTP istek kayıtları): KVKK Md. 5/2-a ("Kanunlarda açıkça öngörülmesi") ve Md. 5/2-ç ("Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi") kapsamında 5651 sayılı Kanun gereğince yasal yükümlülüklerimizin ifası için işlenir.</li>
              <li><strong>Fiziksel Cihaz ve Donanım Parmak İzi:</strong> WebGL GPU model ve shader özellikleri, AudioContext donanım akustik frekans yanıtı, HTML5 Canvas 2D render imzası, CPU çekirdek sayısı, RAM ve ekran çözünürlüğü gibi donanım özellikleri üzerinden türetilen benzersiz donanım tanımlayıcısı (device_uuid); KVKK Md. 5/2-f uyarınca "Veri sorumlusunun meşru menfaati" hukuki sebebine dayalı olarak platform siber güvenliğinin temini, çoklu sahte hesap ve hile istismarının engellenmesi ve yasaklanan kötü niyetli cihazlara donanım engeli (hardware ban) uygulanması amacıyla işlenir.</li>
              <li><strong>Kullanıcı İletişimi ve Mesajlaşma Verileri:</strong> Platform içi birebir özel mesajlar (DM), grup sohbetleri ve genel sohbet (Global Chat) alanındaki metin içerikleri, gönderim zaman damgaları ve alıcı/gönderen bilgileri; KVKK Md. 5/2-c kapsamında sözleşmenin ifası ve platform içi iletişim hizmetinin yürütülmesi amacıyla işlenir ve güvenli veritabanında saklanır.</li>
              <li><strong>Sosyal Akış, Medya ve Dosya Yüklemeleri:</strong> Kullanıcıların kendi tercihleriyle oluşturduğu sosyal gönderiler (posts), yorumlar, beğeniler, 24 saatlik geçici hikayeler (stories), takipçi/arkadaşlık bağlantıları, yüklenen ders notları, sınav belgeleri ve eğitim materyalleri (uploaded_files, subject_files); KVKK Md. 5/2-c ve ilgili verinin kullanıcı tarafından bizzat alenileştirilmiş olması sebebiyle sözleşmenin yürütülmesi amacıyla işlenir.</li>
              <li><strong>Kullanım Analitiği, Ekran Süresi ve Oyun İstatistikleri:</strong> Kullanıcının platformdaki günlük aktif ekran süresi (user_daily_screen_time), oyun galibiyet/mağlubiyet sayıları, liderlik tablosu sıralaması ve sanal çip/puan bakiyeleri; KVKK Md. 5/2-f uyarınca sistem dengesi, performans iyileştirme ve kullanıcı deneyimi meşru menfaatleriyle işlenir.</li>
              <li><strong>Akademik ve Eğitim Destek Verileri:</strong> FMV Ayazağa Işık Lisesi 12-IB diploma programı akademik destek/etüt takvimi etkileşimleri, deneme sınavı sonuçları (mock exams) ve IB not/puan simülasyon hesaplamaları; eğitim araçlarının sunulması ve öğrencilerin kişisel çalışma süreçlerinin kolaylaştırılması amacıyla işlenir.</li>
              <li><strong>Coğrafi Konum, Kamera, Mikrofon ve Ekran Paylaşımı:</strong> Canlı harita GPS koordinatları, kamera ve mikrofon medya akışları; KVKK Md. 5/1 uyarınca yalnızca kullanıcının Açık Rızası (tarayıcı/cihaz izin onayı ve oturum içi aktif başlatma) ile işlenir.</li>
            </ul>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">3. 5651 Sayılı Kanun Kapsamında Erişim Logları ve Saklama Süresi</h4>
            <p>Platformumuz, 5651 sayılı Kanun uyarınca "Yer Sağlayıcı" sıfatına sahiptir. Yasal yükümlülüklerimiz çerçevesinde kullanıcıların sisteme kayıt, giriş ve çıkış işlemlerine ait IP adresi, port bilgisi ve zaman damgası (timestamp) logları mevzuatta öngörülen yasal saklama süresi (en az 1 yıl, en fazla 2 yıl) boyunca güvenli veritabanında muhafaza edilir ve süre bitiminde periyodik olarak imha edilir. Bu loglar yalnızca yetkili adli veya idari mercilerin usulüne uygun resmi talebi halinde kanunla yetkili makamlarla paylaşılır.</p>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">4. Canlı Harita, Coğrafi Konum ve Hava Durumu Entegrasyonu (Açık Rıza, Güvenlik Sapması & Saklama)</h4>
            <p>Canlı Harita ve konum tabanlı servislerimizin işleyiş kuralları şunlardır:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-1">
              <li><strong>Açık Rıza ve İsteğe Bağlılık:</strong> Canlı haritada konum paylaşımı tamamen kullanıcının açık rızasına ve tarayıcı/cihaz izinlerine bağlıdır; konum paylaşılmadan da platformun diğer tüm özellikleri kullanılabilir.</li>
              <li><strong>Güvenlik Sapması (Algoritmik Jitter):</strong> Kullanıcı mahremiyetini ve fiziksel güvenliğini korumak amacıyla, haritada diğer kullanıcılara yansıtılan koordinatlara sistem tarafından otomatik olarak 200 ile 500 metre yarıçapında rastgele güvenlik sapması uygulanır; tam ve noktasal fiziksel adresiniz diğer kullanıcılarla asla paylaşılmaz.</li>
              <li><strong>Kalıcılık ve Saklama Koşulları:</strong> Platform oturumunun sürekliliğinin sağlanması, geçici bağlantı kopmalarında harita deneyiminin kesintiye uğramaması ve sunucu yeniden başlatmalarında tutarlılık amacıyla son bilinen konum verisi (last_known_locations tablosu) oturum süresince veritabanında tutulur. Kullanıcı dilediği an harita arayüzünden konum paylaşımını durdurabilir; paylaşım kapatıldığında konum durumu haritada derhal devre dışı bırakılır.</li>
              <li><strong>Hava Durumu Sorguları:</strong> Hava durumu paneli üzerinden hava tahmini görüntülendiğinde, seçilen veya paylaşılan konum koordinatları tahmin verilerinin çekilmesi amacıyla üçüncü taraf Open-Meteo API servisine teknik zorunluluk olarak anlık iletilir.</li>
            </ul>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">5. Sesli, Görüntülü ve Ekran Paylaşımı İletişimi (WebRTC P2P Mimarisi)</h4>
            <p>Platformdaki sesli/görüntülü odalar ve ekran paylaşımı özellikleri WebRTC (Peer-to-Peer / Eşler Arası) iletişim protokolü ile çalışmaktadır:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-1">
              <li>Kamera, mikrofon ve ekran paylaşımı medya akışları doğrudan odadaki kullanıcıların tarayıcıları arasında uçtan uca şifreli (DTLS/SRTP) olarak aktarılır; sunucularımız üzerinden geçmez ve sunucularımızda kesinlikle kaydedilmez, dinlenmez, izlenmez veya depolanmaz.</li>
              <li>WebRTC teknolojisinin doğası gereği, iki cihaz arasında doğrudan eşler arası bağlantı kurulabilmesi için ağ yönlendirme bilgileri (ICE Candidates / IP ve port bilgileri) Google ve Twilio altyapısındaki STUN sunucuları aracılığıyla eşleşen katılımcı tarayıcıları arasında geçici olarak paylaşılır. Odaya katılan kullanıcı bu teknik iletişim protokolünü kabul etmiş sayılır.</li>
            </ul>
          </section>

          <section className="space-y-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/30">
            <h4 className="font-black text-emerald-700 dark:text-emerald-400 text-sm">6. Oyunlar, Sanal Çipler ve Bahis/Kumar Olmama Beyanı (Kesin Yasal Uyarı)</h4>
            <p>Platformda yer alan oyunlar, liderlik tablosu ve sanal puan/çip sistemi hakkında yasal kurallar şunlardır:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-1">
              <li><strong>Sanal Eğlence ve Zeka Oyunu Amacı:</strong> KapsApp bir kumar, bahis veya şans oyunu platformu KESİNLİKLE DEĞİLDİR. Platformdaki tüm oyunlar yalnızca sosyal etkileşim, arkadaş grubu eğlencesi ve zeka/strateji simülasyonu amacıyla sunulmaktadır.</li>
              <li><strong>Maddi Değeri Kesinlikle Yoktur:</strong> Oyunlarda kullanılan, kazanılan veya liderlik tablosunda sergilenen "çip", "bakiye" veya "puan" birimleri tamamen sanaldır. Gerçek parayla satın alınamaz, nakde, kripto varlığa, hediye çekine veya herhangi bir maddi menfaate dönüştürülemez. Platformda para yatırma veya para çekme mekanizması bulunmamaktadır.</li>
              <li><strong>Platform Dışı Ticaret Yasağı:</strong> Sanal puanların, çiplerin veya kullanıcı hesaplarının gerçek para karşılığında satılması, devredilmesi veya oyun sonuçlarının platform dışında herhangi bir iddiaya/bahse konu edilmesi kesinlikle yasaktır. Bu kuralı ihlal eden hesaplar ve ilişkili donanım parmak izleri derhal ve süresiz olarak engellenir; doğabilecek tüm hukuki ve cezai sorumluluk ilgili kullanıcılara aittir.</li>
              <li><strong>Yönetim Yetkisi:</strong> Platform yönetimi, simülasyon dengesini sağlamak veya hile girişimlerini engellemek amacıyla sanal eğlence puanlarını sıfırlama, düzenleme veya sınırlandırma hakkını saklı tutar.</li>
            </ul>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">7. Kullanıcı İçerikleri, Dosya Paylaşımları ve "Uyar-Kaldır" İlkesi</h4>
            <p>5651 sayılı Kanun’un 5. maddesi uyarınca Yer Sağlayıcı olan Platformumuz, kullanıcılar tarafından oluşturulan ve paylaşılan içerikleri (sohbet mesajları, gönderiler, hikayeler, yüklenen ders notları, PDF/doküman dosyaları, profil detayları, kamera ve ekran paylaşımları) önceden denetlemekle veya hukuka aykırı bir faaliyet olup olmadığını araştırmakla yükümlü değildir.</p>
            <p>Kullanıcıların paylaştığı her türlü metin, görsel, işitsel içerik ve ders dosyasının hukuki ve cezai sorumluluğu münhasıran içeriği yükleyen kullanıcıya aittir.</p>
            <p>Telif haklarını, kişilik haklarını veya yürürlükteki mevzuatı ihlal ettiğini düşündüğünüz içerikler için destekkapsapp@gmail.com adresine "Uyar-Kaldır" bildirimi yapılabilir. Haklı bulunan bildirimler üzerine ilgili içerik derhal yayından kaldırılır ve ihlali gerçekleştiren kullanıcı hesabı askıya alınır.</p>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">8. Çerezler, Çok Katmanlı Yerel Depolama (LocalStorage / IndexedDB / CacheStorage) ve Güvenlik</h4>
            <ul className="list-disc pl-5 space-y-1.5 mt-1">
              <li><strong>Zorunlu Oturum Çerezleri ve LocalStorage:</strong> Kullanıcı kimlik doğrulamasının sürdürülmesi (JWT/token), tema tercihleri (açık/koyu mod) ve aktif oturumun korunması amacıyla tarayıcı yerel depolama alanı kullanılır.</li>
              <li><strong>Anti-Tamper ve Donanım Bütünlüğü Depolaması:</strong> Kötü niyetli kullanıcıların güvenlik engellerini aşmasını, hile yazılımlarını ve platformdan uzaklaştırılan hesapların mükerrer kayıt açmasını engellemek amacıyla cihaz parmak izi özeti localStorage, IndexedDB (KapsSecurityDB) ve CacheStorage katmanlarında eşzamanlı olarak saklanır. Bu depolama meşru menfaat kapsamında platform bütünlüğünü korumak için zorunludur.</li>
            </ul>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">9. Yurt Dışı Veri Aktarımı (KVKK Madde 9 - 7499 Sayılı Kanun Çerçevesi)</h4>
            <p>Platformun teknik altyapısında yüksek erişilebilirlik ve uluslararası güvenlik standartlarına sahip bulut bilişim hizmetleri kullanılmaktadır. Bu kapsamda; veritabanı altyapımız (Turso LibSQL cloud), hava durumu sorguları (Open-Meteo / Almanya), harita katmanı (OpenStreetMap) ve WebRTC bağlantı yönlendirmesi (Google/Twilio STUN) nedeniyle kişisel verileriniz, 6698 sayılı KVKK’nın 9. maddesinde öngörülen hukuki sebepler, sözleşmenin kurulması/ifası ve kullanıcının açık rızası çerçevesinde yurt dışındaki güvenli bulut sunucularında barındırılmakta ve işlenmektedir.</p>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">10. 18 Yaş Altı Kullanıcılar ve Öğrenci Mahremiyeti</h4>
            <p>Platformumuzda lise düzeyinde eğitim destek araçları (FMV Ayazağa Işık Lisesi 12-IB akademik destek programı, etüt takvimi, ders klasörleri ve IB puan hesaplayıcı) yer almaktadır. 18 yaşından küçük öğrencilerin platformu veli veya yasal vasilerinin bilgi ve onayı dahilinde kullanması esastır. Reşit olmayan kullanıcıların canlı konum, ses ve görüntü paylaşımı yaparken veli rehberliğinde hareket etmeleri tavsiye edilir. Yasal veliler diledikleri an destekkapsapp@gmail.com üzerinden başvurarak çocuklarına ait verilerin silinmesini veya hesaplarının kapatılmasını talep edebilirler.</p>
          </section>

          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">11. İlgili Kişinin Hakları ve Başvuru Usulü (KVKK Madde 11)</h4>
            <p>KVKK’nın 11. maddesi uyarınca veri sahipleri; kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme, kişisel verilerin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme, kanunda öngörülen şartlar çerçevesinde kişisel verilerin silinmesini veya yok edilmesini talep etme, bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme ve kanuna aykırı işleme sebebiyle zarara uğraması hâlinde zararın giderilmesini talep etme haklarına sahiptir.</p>
            <p>Haklarınıza ilişkin tüm taleplerinizi Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak kimliğinizi tevsik edici belgelerle birlikte destekkapsapp@gmail.com e-posta adresine iletebilirsiniz. Başvurularınız en geç 30 (otuz) gün içinde ücretsiz olarak sonuçlandırılacaktır.</p>
          </section>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Resmi İletişim: <a href="mailto:destekkapsapp@gmail.com" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">destekkapsapp@gmail.com</a>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              Kapat
            </button>
            {showAcceptButton && (
              <button
                type="button"
                onClick={() => {
                  if (onAccept) onAccept();
                  onClose();
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Okudum ve Kabul Ediyorum</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

