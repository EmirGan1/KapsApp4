import type {Express} from 'express';
import {parseWeather, WEATHER_REFRESH_MS, WEATHER_URL, type WeatherSnapshot} from '../utils/ayvalikWeather';
import {resolveAyvalikUser} from './ayvalikAuth';
// A single fixed-location upstream request serves all visitors; never accept arbitrary URLs.
export function registerAyvalikWeather(app: Express, db: any, fetchWeather: typeof fetch = fetch, now = Date.now) {
  let cache: WeatherSnapshot | undefined;
  let pending: Promise<WeatherSnapshot> | undefined;
  let retryAfter = 0;
  const load = async () => {
    if (cache && now() - cache.fetchedAt < WEATHER_REFRESH_MS) return cache;
    if (now() < retryAfter) throw Error('Upstream cooldown');
    if (!pending) pending = (async () => {
      try {
        const response = await fetchWeather(WEATHER_URL, {signal: AbortSignal.timeout(10000)});
        if (!response.ok) throw Error('Upstream unavailable');
        const data = parseWeather(await response.json());
        cache = {data, fetchedAt: now(), stale: false};
        return cache;
      } catch (e) { retryAfter = now() + 60000; throw e; }
      finally { pending = undefined; }
    })();
    return pending;
  };
  app.get('/api/ayvalik/weather', async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      if (!await resolveAyvalikUser(req, db)) return res.status(401).json({success:false,error:'Giriş yapmanız gerekiyor.'});
      try { return res.json({success:true,...await load()}); }
      catch {
        if (cache && now() - cache.fetchedAt < 6 * 60 * 60 * 1000) return res.json({success:true,...cache,stale:true});
        return res.status(503).json({success:false,error:'Hava durumu servisine ulaşılamıyor. Biraz sonra yeniden dene.'});
      }
    } catch { return res.status(500).json({success:false,error:'Hava durumu yüklenemedi.'}); }
  });
}
