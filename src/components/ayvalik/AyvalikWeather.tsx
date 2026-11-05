import {useEffect, useRef, useState} from 'react';
import {CloudSun, RefreshCw, Clock} from 'lucide-react';
import {getApiUrl, getAuthHeaders} from '../../utils/api';
import {TRIP_DATES, WEATHER_REFRESH_MS, weatherLabel, weatherNumber as n, weatherTime, type WeatherRow, type WeatherSnapshot} from '../../utils/ayvalikWeather';

const dateLabel = (day: string) => new Intl.DateTimeFormat('tr-TR', {timeZone:'Europe/Istanbul', day:'numeric', month:'long', weekday:'short'}).format(new Date(day + 'T12:00:00+03:00'));
const clock = (time: number) => new Intl.DateTimeFormat('tr-TR', {timeZone:'Europe/Istanbul', hour:'2-digit', minute:'2-digit'}).format(time);
const timestamp = (time: number) => new Intl.DateTimeFormat('tr-TR', {timeZone:'Europe/Istanbul', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}).format(time);
function Metric({label, value}: {label: string; value: string}) {
  return <div className="rounded-xl bg-white/10 p-3 min-w-0"><dt className="text-xs opacity-75">{label}</dt><dd className="mt-1 font-bold break-words">{value}</dd></div>;
}
function DayCard({day, title, row, today}: {day:string; title?:string; row?:WeatherRow; today:string}) {
  const v = row?.values;
  return <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3 min-w-0">
    {title && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{title}</p>}
    <h4 className="font-black">{dateLabel(day)}</h4>
    {v ? <><p className="font-semibold text-sm">{weatherLabel(v.weather_code)}</p><p className="text-2xl font-black">{n(v.temperature_2m_max,'°')} <span className="text-base text-slate-500">/ {n(v.temperature_2m_min,'°')}</span></p>
      <dl className="text-sm space-y-2"><div className="flex justify-between gap-2"><dt>Yağış olasılığı</dt><dd>{n(v.precipitation_probability_max,'%')}</dd></div><div className="flex justify-between gap-2"><dt>Toplam yağış</dt><dd>{n(v.precipitation_sum,' mm')}</dd></div><div className="flex justify-between gap-2"><dt>En yüksek rüzgâr</dt><dd>{n(v.wind_speed_10m_max,' km/sa')}</dd></div><div className="flex justify-between gap-2"><dt>Rüzgâr hamlesi</dt><dd>{n(v.wind_gusts_10m_max,' km/sa')}</dd></div><div className="flex justify-between gap-2"><dt>UV indeksi</dt><dd>{n(v.uv_index_max)}</dd></div><div className="flex justify-between gap-2"><dt>Gün doğumu / batımı</dt><dd>{v.sunrise == null ? '—' : clock(v.sunrise)} / {v.sunset == null ? '—' : clock(v.sunset)}</dd></div></dl>
      <p className="text-xs text-slate-500">{(v.precipitation_probability_max ?? 0) >= 40 ? 'Yağmurluk ve suya dayanıklı ayakkabını hazırla.' : (v.wind_gusts_10m_max ?? 0) >= 40 ? 'Açık hava etkinlikleri için rüzgarlığını yanında tut.' : (v.temperature_2m_min ?? 30) < 12 ? 'Sabah ve akşam için katmanlı giyin.' : 'Etkinliklere uygun rahat kıyafetlerini hazırla.'}</p>
    </> : <p className="text-sm text-slate-500">{day < today ? 'Bu gün geçmişte kaldı; bu bölüm canlı tahminleri gösterir.' : 'Bu gün için henüz tahmin yok. 16 günlük tahmin aralığına girdikçe veriler otomatik gösterilecek.'}</p>}
  </article>;
}
export default function AyvalikWeather() {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [hourDay, setHourDay] = useState('next');
  const refresh = useRef<(force?:boolean)=>void>(()=>{});
  useEffect(() => {
    let mounted = true, busy = false, lastAttempt = 0;
    const abort = new AbortController();
    const load = async (force = false) => {
      if (busy || (!force && Date.now() - lastAttempt < WEATHER_REFRESH_MS)) return;
      busy = true; lastAttempt = Date.now(); setLoading(true);
      try {
        const response = await fetch(getApiUrl('/api/ayvalik/weather'), {headers:getAuthHeaders(), signal:AbortSignal.any([abort.signal, AbortSignal.timeout(12000)])});
        const result = await response.json();
        if (!response.ok || !result.success || !result.data?.current || !Array.isArray(result.data?.daily) || !Array.isArray(result.data?.hourly) || !Number.isFinite(result.fetchedAt)) throw Error(result.error || 'Hava durumu alınamadı.');
        if (mounted) { setSnapshot({data:result.data, fetchedAt:result.fetchedAt, stale:result.stale === true}); setError(''); }
      } catch { if (mounted) setError('Güncel veriler alınamadı. Bağlantını kontrol edip yeniden dene.'); }
      finally { busy = false; if (mounted) setLoading(false); }
    };
    refresh.current = load;
    void load(true);
    const timer = setInterval(() => {if (document.visibilityState !== 'hidden') void load();}, WEATHER_REFRESH_MS);
    const focus = () => {if (document.visibilityState !== 'hidden') void load();};
    const online = () => {void load(true);};
    window.addEventListener('focus', focus); window.addEventListener('online', online); document.addEventListener('visibilitychange', focus);
    return () => {mounted = false; abort.abort(); clearInterval(timer); window.removeEventListener('focus', focus); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', focus);};
  }, []);
  const data = snapshot?.data, current = data?.current.values;
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Istanbul', year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now());
  const stale = !!snapshot && (snapshot.stale || !!error || Date.now() - weatherTime(snapshot.data.current.time) > 60 * 60 * 1000);
  const hours = (data?.hourly || []).filter(row => hourDay === 'next' ? weatherTime(row.time) >= Date.now() - 60*60*1000 : row.time.startsWith(hourDay)).slice(0,24);
  return <section aria-label="Ayvalık hava durumu" className="space-y-5 min-w-0">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-2xl flex items-center gap-2"><CloudSun className="shrink-0"/>Ayvalık hava durumu</h2><p className="text-sm text-slate-500 mt-2">Ayvalık merkez · Saatler Türkiye saatidir · Açıkken 15 dakikada bir yenilenir</p></div><button onClick={()=>refresh.current(true)} disabled={loading} className="rounded-xl border px-4 py-3 font-bold text-sm flex items-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/>{loading?'Yükleniyor…':'Hava durumunu yenile'}</button></header>
    <div role="status" aria-live="polite" className="text-sm">{error ? <p className="rounded-xl p-3 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">{error}{snapshot && ' Son alınan veriler gösteriliyor.'}</p> : loading && !snapshot ? 'Ayvalık için güncel veriler yükleniyor…' : snapshot ? `Son başarılı veri alımı: ${timestamp(snapshot.fetchedAt)}` : ''}</div>
    {stale && <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Eski veri — aşağıdaki değerler güncel olmayabilir. Son model saati: {timestamp(weatherTime(data!.current.time))}.</p>}
    {current && <article aria-label="Ayvalık şu an" className="rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-sky-950 via-sky-800 to-teal-700 text-white space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold text-sky-100">{stale?'Son alınan hava durumu':'Şu an · Güncel model verisi'}</p><p className="text-5xl font-black mt-2">{n(current.temperature_2m,'°C')}</p><p className="mt-2 font-bold">{weatherLabel(current.weather_code)}</p></div><div className="text-sm text-sky-100 space-y-2"><p className="flex items-center gap-2"><Clock size={15}/>{timestamp(weatherTime(data!.current.time))}</p><p>Hissedilen: {n(current.apparent_temperature,'°C')}</p>{data?.daily.find(d=>d.time===today) && <p>Bugün {n(data.daily.find(d=>d.time===today)!.values.temperature_2m_min,'°')} / {n(data.daily.find(d=>d.time===today)!.values.temperature_2m_max,'°')}</p>}</div></div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3"><Metric label="Nem" value={n(current.relative_humidity_2m,'%')}/><Metric label="Rüzgâr" value={n(current.wind_speed_10m,' km/sa')}/><Metric label="Rüzgâr yönü" value={n(current.wind_direction_10m,'°')}/><Metric label="Rüzgâr hamlesi" value={n(current.wind_gusts_10m,' km/sa')}/><Metric label="Yağış miktarı" value={n(current.precipitation,' mm')}/><Metric label="Bulutluluk" value={n(current.cloud_cover,'%')}/><Metric label="Deniz seviyesi basıncı" value={n(current.pressure_msl,' hPa')}/></dl>
    </article>}
    <div className="space-y-3"><h3 className="text-xl font-black">25–27 Kasım · Gezi tahmini</h3><p className="text-sm text-slate-500">Uzun vadeli tahminler değişebilir. Gezi tarihleri yaklaştıkça API’nin yeni tahminleri burada güncellenir; henüz veri olmayan günlere tahmin yazılmaz.</p><div className="grid gap-4 lg:grid-cols-3">{TRIP_DATES.map((day,i)=><DayCard key={day} day={day} title={`${i+1}. gezi günü`} today={today} row={data?.daily.find(d=>d.time===day)}/>)}</div></div>
    {data && <><div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black">Saatlik tahmin</h3><select aria-label="Saatlik tahmin günü" value={hourDay} onChange={e=>setHourDay(e.target.value)} className="rounded-xl border p-3 bg-white dark:bg-slate-900 max-w-full"><option value="next">Önümüzdeki 24 saat</option>{TRIP_DATES.filter(day=>data.hourly.some(h=>h.time.startsWith(day))).map(day=><option key={day} value={day}>{dateLabel(day)}</option>)}</select></div><div tabIndex={0} role="region" aria-label="Saatlik hava tablosu" className="overflow-x-auto rounded-2xl border"><table className="w-full text-sm whitespace-nowrap"><thead className="bg-slate-100 dark:bg-slate-800"><tr>{['Saat','Durum','Sıcaklık','Hissedilen','Yağış olasılığı','Yağış','Rüzgâr','Nem'].map(h=><th key={h} scope="col" className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{hours.map(h=><tr key={h.time} className="border-t border-slate-200 dark:border-slate-800"><th scope="row" className="p-3 text-left">{timestamp(weatherTime(h.time))}</th><td className="p-3">{weatherLabel(h.values.weather_code)}</td><td className="p-3">{n(h.values.temperature_2m,'°C')}</td><td className="p-3">{n(h.values.apparent_temperature,'°C')}</td><td className="p-3">{n(h.values.precipitation_probability,'%')}</td><td className="p-3">{n(h.values.precipitation,' mm')}</td><td className="p-3">{n(h.values.wind_speed_10m,' km/sa')}</td><td className="p-3">{n(h.values.relative_humidity_2m,'%')}</td></tr>)}</tbody></table>{!hours.length && <p className="p-4 text-sm">Bu aralıkta saatlik veri yok.</p>}</div></div>
      <div className="space-y-3"><h3 className="text-xl font-black">Yaklaşan 5 gün</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.daily.filter(d=>d.time>=today).slice(0,5).map(row=><DayCard key={row.time} day={row.time} today={today} row={row}/>)}</div></div></>}
    <footer className="text-xs text-slate-500 flex flex-wrap gap-3"><a className="underline" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Hava verisi: Open-Meteo (CC BY 4.0)</a><a className="underline" href="https://www.mgm.gov.tr/?il=Balikesir&ilce=Ayvalik" target="_blank" rel="noopener noreferrer">MGM Ayvalık ve resmî uyarılar ↗</a><span>Model tahminidir; kesin hava koşulu veya resmî uyarı değildir.</span></footer>
  </section>;
}
