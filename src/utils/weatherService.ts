export interface WeatherLocation {
  name: string;
  district?: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  precipitation: number;
  rain: number;
  showers: number;
  snowfall: number;
  weatherCode: number;
  cloudCover: number;
  surfacePressure: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  isDay: boolean;
  time: string;
}

export interface HourlyForecastItem {
  time: string;
  hourLabel: string;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windGusts: number;
  uvIndex: number;
  visibility: number;
  isDay: boolean;
}

export interface DailyForecastItem {
  date: string;
  dayLabel: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  apparentTemperatureMax: number;
  apparentTemperatureMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherAlert {
  id: string;
  severity: 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  icon: string;
}

export interface WeatherData {
  location: WeatherLocation;
  current: CurrentWeather;
  hourly: HourlyForecastItem[];
  allHourly?: HourlyForecastItem[];
  daily: DailyForecastItem[];
  alerts: WeatherAlert[];
  lastUpdated: number;
}

export interface WeatherInfoMeta {
  label: string;
  iconName: string;
  emoji: string;
  description: string;
  bgGradientDay: string;
  bgGradientNight: string;
}

export const WMO_WEATHER_MAP: Record<number, WeatherInfoMeta> = {
  0: {
    label: 'Açık',
    iconName: 'Sun',
    emoji: '☀️',
    description: 'Gökyüzü tamamen açık, pırıl pırıl güneşli.',
    bgGradientDay: 'from-sky-400 via-blue-500 to-indigo-600',
    bgGradientNight: 'from-slate-900 via-indigo-950 to-blue-950',
  },
  1: {
    label: 'Çoğunlukla Açık',
    iconName: 'CloudSun',
    emoji: '🌤️',
    description: 'Genel olarak açık, yer yer ince bulutlar.',
    bgGradientDay: 'from-sky-400 via-blue-500 to-indigo-500',
    bgGradientNight: 'from-slate-900 via-slate-800 to-indigo-950',
  },
  2: {
    label: 'Parçalı Bulutlu',
    iconName: 'CloudSun',
    emoji: '⛅',
    description: 'Güneş ve bulutlar bir arada.',
    bgGradientDay: 'from-blue-400 via-sky-500 to-slate-600',
    bgGradientNight: 'from-slate-900 via-slate-800 to-blue-950',
  },
  3: {
    label: 'Çok Bulutlu / Kapalı',
    iconName: 'Cloud',
    emoji: '☁️',
    description: 'Gökyüzü yoğun bulut örtüsüyle kaplı.',
    bgGradientDay: 'from-slate-500 via-slate-600 to-zinc-700',
    bgGradientNight: 'from-zinc-900 via-slate-900 to-neutral-950',
  },
  45: {
    label: 'Sisli',
    iconName: 'CloudFog',
    emoji: '🌫️',
    description: 'Görüş mesafesi düşük, yoğun sis tabakası.',
    bgGradientDay: 'from-slate-400 via-zinc-500 to-stone-600',
    bgGradientNight: 'from-zinc-900 via-neutral-900 to-slate-950',
  },
  48: {
    label: 'Kırağılı Sis',
    iconName: 'CloudFog',
    emoji: '🌫️',
    description: 'Buz parçacıklı yoğun sis.',
    bgGradientDay: 'from-slate-400 via-slate-500 to-cyan-700',
    bgGradientNight: 'from-slate-900 via-cyan-950 to-neutral-950',
  },
  51: {
    label: 'Hafif Çisenti',
    iconName: 'CloudDrizzle',
    emoji: '🌦️',
    description: 'Hafif ve ince taneli yağış.',
    bgGradientDay: 'from-sky-500 via-blue-600 to-slate-700',
    bgGradientNight: 'from-slate-900 via-blue-950 to-slate-900',
  },
  53: {
    label: 'Çisenti',
    iconName: 'CloudDrizzle',
    emoji: '🌧️',
    description: 'Orta kuvvette sürekli çisenti.',
    bgGradientDay: 'from-blue-500 via-slate-600 to-slate-700',
    bgGradientNight: 'from-slate-900 via-slate-950 to-blue-950',
  },
  55: {
    label: 'Yoğun Çisenti',
    iconName: 'CloudDrizzle',
    emoji: '🌧️',
    description: 'Görüşü etkileyen yoğun çisenti yağışı.',
    bgGradientDay: 'from-blue-600 via-slate-700 to-slate-800',
    bgGradientNight: 'from-slate-950 via-blue-950 to-black',
  },
  56: {
    label: 'Dondurucu Çisenti',
    iconName: 'CloudSnow',
    emoji: '🌨️',
    description: 'Yere çarptığında donan soğuk çisenti.',
    bgGradientDay: 'from-cyan-600 via-blue-700 to-slate-800',
    bgGradientNight: 'from-cyan-950 via-slate-950 to-black',
  },
  57: {
    label: 'Yoğun Dondurucu Çisenti',
    iconName: 'CloudSnow',
    emoji: '🌨️',
    description: 'Zemin donmasına sebep olan dondurucu yağış.',
    bgGradientDay: 'from-cyan-700 via-slate-700 to-slate-900',
    bgGradientNight: 'from-cyan-950 via-slate-950 to-black',
  },
  61: {
    label: 'Hafif Yağmurlu',
    iconName: 'CloudRain',
    emoji: '🌧️',
    description: 'Aralıklı hafif yağmur.',
    bgGradientDay: 'from-blue-500 via-sky-600 to-slate-700',
    bgGradientNight: 'from-slate-900 via-blue-950 to-slate-950',
  },
  63: {
    label: 'Orta Yağmurlu',
    iconName: 'CloudRain',
    emoji: '🌧️',
    description: 'Sürekli normal kuvvette yağmur.',
    bgGradientDay: 'from-blue-600 via-indigo-700 to-slate-800',
    bgGradientNight: 'from-blue-950 via-slate-900 to-black',
  },
  65: {
    label: 'Kuvvetli Yağmurlu',
    iconName: 'CloudRain',
    emoji: '🌧️',
    description: 'Şiddetli ve yoğun yağmur.',
    bgGradientDay: 'from-blue-700 via-indigo-800 to-slate-900',
    bgGradientNight: 'from-blue-950 via-indigo-950 to-black',
  },
  66: {
    label: 'Dondurucu Yağmur',
    iconName: 'CloudSnow',
    emoji: '🌨️',
    description: 'Hafif dondurucu yağmur, buzlanma riski.',
    bgGradientDay: 'from-cyan-600 via-blue-700 to-slate-800',
    bgGradientNight: 'from-cyan-950 via-slate-900 to-black',
  },
  67: {
    label: 'Kuvvetli Dondurucu Yağmur',
    iconName: 'CloudSnow',
    emoji: '🌨️',
    description: 'Kuvvetli buz yağmuru ve gizli buzlanma.',
    bgGradientDay: 'from-cyan-700 via-slate-800 to-slate-950',
    bgGradientNight: 'from-cyan-950 via-slate-950 to-black',
  },
  71: {
    label: 'Hafif Kar Yağışlı',
    iconName: 'CloudSnow',
    emoji: '❄️',
    description: 'Uçuşan hafif kar taneleri.',
    bgGradientDay: 'from-sky-300 via-indigo-400 to-slate-600',
    bgGradientNight: 'from-slate-900 via-slate-800 to-indigo-950',
  },
  73: {
    label: 'Kar Yağışlı',
    iconName: 'CloudSnow',
    emoji: '🌨️',
    description: 'Normal kuvvette lapa lapa kar yağışı.',
    bgGradientDay: 'from-indigo-400 via-slate-500 to-slate-700',
    bgGradientNight: 'from-indigo-950 via-slate-900 to-slate-950',
  },
  75: {
    label: 'Yoğun Kar Fırtınası',
    iconName: 'CloudSnow',
    emoji: '❄️',
    description: 'Zemini hızla kaplayan yoğun tipi ve kar.',
    bgGradientDay: 'from-slate-500 via-indigo-600 to-slate-800',
    bgGradientNight: 'from-slate-950 via-indigo-950 to-black',
  },
  77: {
    label: 'Kar Taneleri / Granül',
    iconName: 'CloudSnow',
    emoji: '🌨️',
    description: 'İnce sert kar kristalleri.',
    bgGradientDay: 'from-sky-400 via-slate-500 to-slate-700',
    bgGradientNight: 'from-slate-900 via-slate-950 to-black',
  },
  80: {
    label: 'Hafif Sağanak',
    iconName: 'CloudRain',
    emoji: '🌦️',
    description: 'Kısa süreli hafif sağanak geçişleri.',
    bgGradientDay: 'from-blue-400 via-indigo-600 to-slate-700',
    bgGradientNight: 'from-slate-900 via-blue-950 to-black',
  },
  81: {
    label: 'Sağanak Yağışlı',
    iconName: 'CloudRain',
    emoji: '🌧️',
    description: 'Kuvvetli ani sağanak yağmur.',
    bgGradientDay: 'from-blue-600 via-indigo-700 to-slate-800',
    bgGradientNight: 'from-blue-950 via-slate-950 to-black',
  },
  82: {
    label: 'Şiddetli Sağanak',
    iconName: 'CloudRain',
    emoji: '⛈️',
    description: 'Su baskını riski oluşturan şiddetli sağanak.',
    bgGradientDay: 'from-blue-700 via-indigo-800 to-slate-900',
    bgGradientNight: 'from-indigo-950 via-slate-950 to-black',
  },
  85: {
    label: 'Hafif Kar Sağanağı',
    iconName: 'CloudSnow',
    emoji: '🌨️',
    description: 'Aralıklı hafif kar sağanakları.',
    bgGradientDay: 'from-sky-400 via-indigo-500 to-slate-700',
    bgGradientNight: 'from-slate-900 via-indigo-950 to-black',
  },
  86: {
    label: 'Yoğun Kar Sağanağı',
    iconName: 'CloudSnow',
    emoji: '❄️',
    description: 'Ani ve kuvvetli kar sağanağı.',
    bgGradientDay: 'from-slate-500 via-indigo-700 to-slate-900',
    bgGradientNight: 'from-indigo-950 via-slate-950 to-black',
  },
  95: {
    label: 'Gök Gürültülü Fırtına',
    iconName: 'CloudLightning',
    emoji: '⛈️',
    description: 'Şimşek ve gök gürültüsü eşliğinde fırtına.',
    bgGradientDay: 'from-slate-700 via-indigo-900 to-slate-950',
    bgGradientNight: 'from-slate-950 via-indigo-950 to-black',
  },
  96: {
    label: 'Dolulu Fırtına',
    iconName: 'CloudLightning',
    emoji: '⛈️',
    description: 'Hafif dolu yağışlı gök gürültülü fırtına.',
    bgGradientDay: 'from-slate-800 via-indigo-900 to-slate-950',
    bgGradientNight: 'from-slate-950 via-purple-950 to-black',
  },
  99: {
    label: 'Şiddetli Dolulu Fırtına',
    iconName: 'CloudLightning',
    emoji: '⚡',
    description: 'Kuvvetli dolu ve şiddetli fırtına uyarısı!',
    bgGradientDay: 'from-purple-900 via-slate-900 to-black',
    bgGradientNight: 'from-purple-950 via-slate-950 to-black',
  },
};

export const DEFAULT_ISTANBUL_LOCATION: WeatherLocation = {
  name: 'İstanbul (Varsayılan Konum)',
  district: 'Fatih',
  city: 'İstanbul',
  country: 'Türkiye',
  latitude: 41.0082,
  longitude: 28.9784,
  isDefault: true,
};

export function getWeatherMeta(code: number, isDay = true): WeatherInfoMeta {
  const meta = WMO_WEATHER_MAP[code] || WMO_WEATHER_MAP[0];
  if (!isDay && code === 0) {
    return {
      ...meta,
      label: 'Açık Gece',
      iconName: 'Moon',
      emoji: '🌙',
      description: 'Gökyüzü açık, yıldızlı ve berrak bir gece.',
    };
  }
  return meta;
}

export function getUVLevelText(uv: number): { text: string; color: string; desc: string } {
  if (uv <= 2) return { text: 'Düşük', color: 'text-emerald-400', desc: 'Korunma gerektirmez, güvenle dışarı çıkabilirsiniz.' };
  if (uv <= 5) return { text: 'Orta', color: 'text-yellow-400', desc: 'Öğle saatlerinde gölgede kalın, şapka kullanın.' };
  if (uv <= 7) return { text: 'Yüksek', color: 'text-amber-500', desc: 'Güneş kremi ve gözlük kullanımı önerilir.' };
  if (uv <= 10) return { text: 'Çok Yüksek', color: 'text-rose-500', desc: '11:00 - 16:00 arası doğrudan güneşe çıkmaktan kaçının.' };
  return { text: 'Aşırı Tehlikeli', color: 'text-purple-400', desc: 'Tüm açık hava faaliyetlerinde azami korunun!' };
}

export function getWindDirectionText(degrees: number): string {
  const directions = ['Kuzey (K)', 'Kuzeydoğu (KD)', 'Doğu (D)', 'Güneydoğu (GD)', 'Güney (G)', 'Güneybatı (GB)', 'Batı (B)', 'Kuzeybatı (KB)'];
  const index = Math.round((degrees % 360) / 45) % 8;
  return directions[index];
}

/**
 * Reverse geocode coordinates using BigDataCloud's free reverse geocoding API with Turkish locale
 */
export async function reverseGeocode(lat: number, lon: number): Promise<{ district?: string; city?: string; displayName: string }> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=tr`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();

    const district = data.locality || data.localityInfo?.administrative?.[3]?.name || data.localityInfo?.administrative?.[2]?.name || '';
    const city = data.city || data.principalSubdivision || '';
    const country = data.countryName || 'Türkiye';

    let displayName = '';
    if (district && city && district !== city) {
      displayName = `${district}, ${city}`;
    } else if (city) {
      displayName = `${city}, ${country}`;
    } else if (district) {
      displayName = `${district}, ${country}`;
    } else {
      displayName = `${lat.toFixed(2)}°K, ${lon.toFixed(2)}°D`;
    }

    return { district, city, displayName };
  } catch (err) {
    return {
      displayName: `${lat.toFixed(2)}°K, ${lon.toFixed(2)}°D`,
    };
  }
}

/**
 * Search locations via Open-Meteo Geocoding API
 */
export async function searchLocations(query: string): Promise<WeatherLocation[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=tr&format=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((r: any) => ({
      name: `${r.name}${r.admin1 ? `, ${r.admin1}` : ''}${r.country ? ` (${r.country})` : ''}`,
      district: r.admin2 || r.admin1,
      city: r.name,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
      isDefault: false,
    }));
  } catch {
    return [];
  }
}

/**
 * Analyze weather data to find critical meteorological warnings
 */
export function analyzeWeatherAlerts(current: CurrentWeather, hourly: HourlyForecastItem[], daily: DailyForecastItem[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  // 1. High Wind / Wind Gust Alert
  if (current.windGusts >= 60 || current.windSpeed >= 45) {
    alerts.push({
      id: 'high-wind',
      severity: 'danger',
      title: '🌪️ Şiddetli Fırtına & Rüzgar Uyarısı',
      description: `Rüzgar hamlesi ${Math.round(current.windGusts)} km/s hızına ulaşıyor. Çatı uçması, ağaç devrilmesi ve ulaşımda aksamalara karşı tedbirli olun.`,
      icon: 'Wind',
    });
  } else if (current.windGusts >= 45 || current.windSpeed >= 32) {
    alerts.push({
      id: 'moderate-wind',
      severity: 'warning',
      title: '💨 Kuvvetli Rüzgar Uyarısı',
      description: `Rüzgar hızının ${Math.round(current.windSpeed)} km/s (${Math.round(current.windGusts)} km/s hamle) olması beklenmektedir.`,
      icon: 'Wind',
    });
  }

  // 2. Thunderstorm / Lightning Alert
  if ([95, 96, 99].includes(current.weatherCode)) {
    alerts.push({
      id: 'thunderstorm',
      severity: 'danger',
      title: '⚡ Gök Gürültülü Şiddetli Fırtına',
      description: 'Yıldırım düşmesi, ani su baskını ve yerel dolu riski mevcuttur. Açık alanlarda bulunmaktan kaçının.',
      icon: 'CloudLightning',
    });
  }

  // 3. Heavy Rain / Torrential Precipitation
  if (current.precipitation >= 8 || [65, 82].includes(current.weatherCode)) {
    alerts.push({
      id: 'heavy-rain',
      severity: 'danger',
      title: '🌊 Yoğun Sağanak Yağış & Su Baskını Tehlikesi',
      description: 'Kuvvetli yağış nedeniyle cadde ve sokaklarda su birikintisi, alt geçit tıkanmaları meydana gelebilir.',
      icon: 'CloudRain',
    });
  } else {
    // Check if rain probability is extremely high in next 6 hours
    const next6HoursRain = hourly.slice(0, 6).find((h) => h.precipitationProbability >= 80 && h.precipitation >= 2);
    if (next6HoursRain) {
      alerts.push({
        id: 'upcoming-rain',
        severity: 'warning',
        title: `🌧️ Yaklaşan Kuvvetli Yağış (${next6HoursRain.hourLabel})`,
        description: `Önümüzdeki saatlerde yağış olasılığı %${next6HoursRain.precipitationProbability} seviyesine çıkacaktır. Yanınıza şemsiye almayı unutmayın.`,
        icon: 'Umbrella',
      });
    }
  }

  // 4. Freezing / Ice / Snow
  if (current.temperature <= 0 || [71, 73, 75, 85, 86].includes(current.weatherCode)) {
    alerts.push({
      id: 'frost-snow',
      severity: 'warning',
      title: '❄️ Don ve Gizli Buzlanma Riski',
      description: `Hava sıcaklığı ${current.temperature}°C. Karayollarında ve yaya kaldırımlarında kayma tehlikesine karşı dikkatli olun.`,
      icon: 'CloudSnow',
    });
  }

  // 5. Extreme UV Alert (if current daytime or upcoming max)
  const todayMaxUV = daily[0]?.uvIndexMax || 0;
  if (todayMaxUV >= 8 && current.isDay) {
    alerts.push({
      id: 'uv-danger',
      severity: 'warning',
      title: `☀️ Çok Yüksek UV İndeksi (${todayMaxUV})`,
      description: 'Güneş ışınları tehlikeli seviyede. Açık tenlilerde güneş yanığı ve göz rahatsızlığı riski yüksektir.',
      icon: 'Sun',
    });
  }

  // 6. Dense Fog Alert
  if ([45, 48].includes(current.weatherCode) || (hourly[0]?.visibility && hourly[0].visibility < 1500)) {
    alerts.push({
      id: 'fog-warning',
      severity: 'warning',
      title: '🌫️ Yoğun Sis & Düşük Görüş Mesafesi',
      description: 'Görüş mesafesi belirgin şekilde düşmüştür. Araç kullananların takip mesafesini artırması önerilir.',
      icon: 'CloudFog',
    });
  }

  return alerts;
}

/**
 * Fetch complete weather forecast from Open-Meteo
 */
export async function fetchWeatherForecast(lat: number, lon: number, locationName?: string): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,visibility,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo API hatası: ${res.status}`);
  }

  const data = await res.json();

  // Current
  const current: CurrentWeather = {
    temperature: Math.round(data.current.temperature_2m),
    apparentTemperature: Math.round(data.current.apparent_temperature),
    relativeHumidity: data.current.relative_humidity_2m,
    precipitation: data.current.precipitation,
    rain: data.current.rain,
    showers: data.current.showers,
    snowfall: data.current.snowfall,
    weatherCode: data.current.weather_code,
    cloudCover: data.current.cloud_cover,
    surfacePressure: Math.round(data.current.surface_pressure || data.current.pressure_msl),
    windSpeed: Math.round(data.current.wind_speed_10m),
    windDirection: data.current.wind_direction_10m,
    windGusts: Math.round(data.current.wind_gusts_10m),
    isDay: Boolean(data.current.is_day),
    time: data.current.time,
  };

  // Hourly (find current hour index)
  const currentIsoPrefix = data.current.time.substring(0, 13);
  let startHourIdx = data.hourly.time.findIndex((t: string) => t.startsWith(currentIsoPrefix));
  if (startHourIdx === -1) startHourIdx = 0;

  const hourly: HourlyForecastItem[] = [];
  const totalHours = Math.min(startHourIdx + 36, data.hourly.time.length);

  for (let i = startHourIdx; i < totalHours; i++) {
    const rawTime = data.hourly.time[i];
    const dateObj = new Date(rawTime);
    const hourLabel = i === startHourIdx ? 'Şimdi' : `${dateObj.getHours().toString().padStart(2, '0')}:00`;

    hourly.push({
      time: rawTime,
      hourLabel,
      temperature: Math.round(data.hourly.temperature_2m[i]),
      apparentTemperature: Math.round(data.hourly.apparent_temperature[i]),
      precipitationProbability: data.hourly.precipitation_probability[i] || 0,
      precipitation: data.hourly.precipitation[i] || 0,
      weatherCode: data.hourly.weather_code[i],
      windSpeed: Math.round(data.hourly.wind_speed_10m[i]),
      windGusts: Math.round(data.hourly.wind_gusts_10m[i]),
      uvIndex: Math.round(data.hourly.uv_index[i] || 0),
      visibility: Math.round((data.hourly.visibility[i] || 10000) / 1000), // in km
      isDay: Boolean(data.hourly.is_day[i]),
    });
  }

  // Full 7-Day Hourly breakdown (168 hours) for day detail modal
  const allHourly: HourlyForecastItem[] = [];
  for (let i = 0; i < data.hourly.time.length; i++) {
    const rawTime = data.hourly.time[i];
    const dateObj = new Date(rawTime);
    const hourLabel = `${dateObj.getHours().toString().padStart(2, '0')}:00`;

    allHourly.push({
      time: rawTime,
      hourLabel,
      temperature: Math.round(data.hourly.temperature_2m[i]),
      apparentTemperature: Math.round(data.hourly.apparent_temperature[i]),
      precipitationProbability: data.hourly.precipitation_probability[i] || 0,
      precipitation: Number(data.hourly.precipitation[i] || 0),
      weatherCode: data.hourly.weather_code[i],
      windSpeed: Math.round(data.hourly.wind_speed_10m[i]),
      windGusts: Math.round(data.hourly.wind_gusts_10m[i]),
      uvIndex: Math.round(data.hourly.uv_index[i] || 0),
      visibility: Math.round((data.hourly.visibility[i] || 10000) / 1000),
      isDay: Boolean(data.hourly.is_day[i]),
    });
  }

  // Daily (7-day forecast)
  const daily: DailyForecastItem[] = [];
  const dayNamesTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  for (let d = 0; d < Math.min(7, data.daily.time.length); d++) {
    const rawDate = data.daily.time[d];
    const dObj = new Date(rawDate);
    const dayLabel = d === 0 ? 'Bugün' : d === 1 ? 'Yarın' : dayNamesTr[dObj.getDay()];

    daily.push({
      date: rawDate,
      dayLabel,
      weatherCode: data.daily.weather_code[d],
      temperatureMax: Math.round(data.daily.temperature_2m_max[d]),
      temperatureMin: Math.round(data.daily.temperature_2m_min[d]),
      apparentTemperatureMax: Math.round(data.daily.apparent_temperature_max[d]),
      apparentTemperatureMin: Math.round(data.daily.apparent_temperature_min[d]),
      precipitationSum: Number(data.daily.precipitation_sum[d] || 0),
      precipitationProbabilityMax: data.daily.precipitation_probability_max[d] || 0,
      windSpeedMax: Math.round(data.daily.wind_speed_10m_max[d] || 0),
      uvIndexMax: Math.round(data.daily.uv_index_max[d] || 0),
      sunrise: data.daily.sunrise[d] ? data.daily.sunrise[d].substring(11, 16) : '06:00',
      sunset: data.daily.sunset[d] ? data.daily.sunset[d].substring(11, 16) : '19:30',
    });
  }

  const alerts = analyzeWeatherAlerts(current, hourly, daily);

  return {
    location: {
      name: locationName || 'Bilinmeyen Konum',
      latitude: lat,
      longitude: lon,
    },
    current,
    hourly,
    allHourly,
    daily,
    alerts,
    lastUpdated: Date.now(),
  };
}

/**
 * Storage helpers for caching weather data and active location
 */
const WEATHER_CACHE_KEY = 'kaps_weather_cached_data';
const WEATHER_LOCATION_KEY = 'kaps_weather_active_location';

export function getCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCachedWeather(data: WeatherData) {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
    // Dispatch custom event so sidebar badge can update instantly
    window.dispatchEvent(new CustomEvent('kaps:weather_updated', { detail: data }));
  } catch {}
}

export function getSavedWeatherLocation(): WeatherLocation | null {
  try {
    const raw = localStorage.getItem(WEATHER_LOCATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveWeatherLocation(loc: WeatherLocation) {
  try {
    localStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(loc));
  } catch {}
}
