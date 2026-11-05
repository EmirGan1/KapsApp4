export const WEATHER_REFRESH_MS = 15 * 60 * 1000;
export const TRIP_DATES = ['2026-11-25', '2026-11-26', '2026-11-27'];
export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
  latitude: '39.319', longitude: '26.695', timezone: 'Europe/Istanbul', forecast_days: '16',
  current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
  hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max',
  wind_speed_unit: 'kmh', temperature_unit: 'celsius', precipitation_unit: 'mm'
});
export type WeatherValues = Record<string, number | null>;
export interface WeatherRow { time: string; values: WeatherValues }
export interface AyvalikWeather { current: WeatherRow; hourly: WeatherRow[]; daily: WeatherRow[] }
export interface WeatherSnapshot { data: AyvalikWeather; fetchedAt: number; stale: boolean }
const localTime = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) && Number.isFinite(Date.parse(value + '+03:00'));
export const weatherTime = (time: string) => Date.parse(time + '+03:00');
const numberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function parseWeather(raw: any): AyvalikWeather {
  if (!localTime(raw?.current?.time) || numberOrNull(raw.current.temperature_2m) === null || !Array.isArray(raw?.daily?.time) || !Array.isArray(raw?.hourly?.time)) throw Error('Hava verisi eksik.');
  const rows = (source: any, daily: boolean): WeatherRow[] => source.time.slice(0, daily ? 16 : 384).flatMap((time: unknown, i: number) => {
    if (daily ? typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(time) : !localTime(time)) return [];
    const values: WeatherValues = {};
    for (const [key, list] of Object.entries(source)) if (key !== 'time' && Array.isArray(list)) values[key] = numberOrNull(list[i]);
    // Sunrise/sunset are timestamps, converted to epoch milliseconds for consistent display.
    for (const key of ['sunrise', 'sunset']) if (daily && localTime(source[key]?.[i])) values[key] = weatherTime(source[key][i]);
    return [{ time: time as string, values }];
  });
  return { current: { time: raw.current.time, values: Object.fromEntries(Object.entries(raw.current).filter(([k]) => k !== 'time').map(([k, v]) => [k, numberOrNull(v)])) }, hourly: rows(raw.hourly, false), daily: rows(raw.daily, true) };
}
export function weatherLabel(code: number | null): string {
  if (code === 0) return 'Açık';
  if (code === 1) return 'Çoğunlukla açık';
  if (code === 2) return 'Parçalı bulutlu';
  if (code === 3) return 'Kapalı';
  if (code === 45 || code === 48) return 'Sisli';
  if (code !== null && [51,53,55,56,57].includes(code)) return 'Çiseleme';
  if (code !== null && [61,63,65,66,67,80,81,82].includes(code)) return 'Yağmurlu';
  if (code !== null && [71,73,75,77,85,86].includes(code)) return 'Karlı';
  if (code !== null && [95,96,99].includes(code)) return 'Gök gürültülü sağanak';
  return 'Durum bilgisi yok';
}
export const weatherNumber = (value: number | null | undefined, suffix = '') => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('tr-TR', {maximumFractionDigits:1}).format(value) + suffix;
