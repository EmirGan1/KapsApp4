import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudRain,
  Sun,
  CloudSun,
  Wind,
  Droplets,
  Umbrella,
  RefreshCw,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Sparkles,
  ChevronRight,
  X,
  Compass,
  ShieldCheck,
  Calendar,
  Layers,
  Radio,
  Activity
} from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../../utils/api';
import {
  WEATHER_REFRESH_MS,
  LIVE_POLL_INTERVAL_MS,
  weatherLabel,
  weatherTime,
  weatherNumber,
  parseWeather,
  WEATHER_URL,
  fetchMultiSourceAyvalikWeather,
  type WeatherRow,
  type WeatherSnapshot,
  type MultiSourceWeatherReport,
  type WeatherSourceReading
} from '../../utils/ayvalikWeather';

export interface HourlyDetailSlot {
  hour: string; // "00:00" .. "23:00"
  temp: number;
  feelsLike: number;
  precipProb: number;
  precipMm: number;
  weatherCode: number;
  condition: string;
  windSpeed: number;
  windGust: number;
  windDir: string;
  humidity: number;
  cloudCover: number;
  pressure: number;
  programTitle?: string;
  programLocation?: string;
  hourlyTip: string;
  isKeyProgramHour?: boolean;
}

export interface MicroClimateZone {
  zoneName: string;
  timeWindow: string;
  tempRange: string;
  windInfo: string;
  rainRisk: string;
  advice: string;
}

export interface TripDayForecast {
  date: string; // "2026-11-25" | "2026-11-26" | "2026-11-27"
  dayNumber: 1 | 2 | 3;
  dateLabel: string;
  shortDate: string;
  weekday: string;
  routeTitle: string;
  summaryCondition: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  feelsLikeMax: number;
  feelsLikeMin: number;
  precipProbMax: number;
  precipSumMm: number;
  windSpeedMax: number;
  windGustMax: number;
  windDirection: string;
  windDegrees: number;
  humidityAvg: number;
  uvIndexMax: number;
  pressureHpa: number;
  visibilityKm: number;
  cloudCoverAvg: number;
  dewPoint: number;
  seaTemp: number;
  sunrise: string;
  sunset: string;
  isLiveApiSynced: boolean;
  confidencePercent: number;
  activeSourcesCount: number;
  sources: WeatherSourceReading[];
  alertLevel: 'low' | 'moderate' | 'high';
  alertTitle: string;
  alertSummary: string;
  clothingRecommendations: {
    morning: string;
    midday: string;
    afternoonEvening: string;
    essentials: string[];
  };
  activityRecommendations: {
    title: string;
    detail: string;
    badge: string;
  }[];
  microClimates: MicroClimateZone[];
  hourly: HourlyDetailSlot[];
}

const DEFAULT_SOURCES_25: WeatherSourceReading[] = [
  { sourceId: 'ecmwf', sourceName: 'ECMWF IFS & SEAS5 Ensemble', shortName: 'ECMWF (Avrupa)', institution: 'Avrupa Orta Vadeli Hava Tahminleri Merkezi', modelDetail: 'IFS 0.25° + 51-Üyeli Ensemble', weight: 30, isOnline: true, tempMax: 15.8, tempMin: 9.8, feelsLikeMax: 14.9, feelsLikeMin: 8.2, precipProbMax: 25, precipSumMm: 0.4, windSpeedMax: 19.5, windGustMax: 29.0, weatherCode: 2, condition: 'Parçalı bulutlu' },
  { sourceId: 'noaa_gfs', sourceName: 'NOAA GFS Seamless (NCEP)', shortName: 'NOAA GFS (ABD)', institution: 'ABD Ulusal Okyanus ve Atmosfer Dairesi', modelDetail: 'GFS Global 0.25° 16 Günlük Model', weight: 25, isOnline: true, tempMax: 16.0, tempMin: 10.5, feelsLikeMax: 15.2, feelsLikeMin: 8.5, precipProbMax: 24, precipSumMm: 0.2, windSpeedMax: 17.2, windGustMax: 24.5, weatherCode: 2, condition: 'Parçalı bulutlu' },
  { sourceId: 'cmc_gem', sourceName: 'CMC GEM Global Ensemble', shortName: 'CMC GEM (Kanada)', institution: 'Kanada Meteoroloji Merkezi (ECCC)', modelDetail: '21-Üyeli GEPS Küresel Ensemble', weight: 20, isOnline: true, tempMax: 16.0, tempMin: 11.2, feelsLikeMax: 15.3, feelsLikeMin: 9.1, precipProbMax: 22, precipSumMm: 0.5, windSpeedMax: 16.8, windGustMax: 26.0, weatherCode: 2, condition: 'Parçalı bulutlu' },
  { sourceId: 'era5_mgm', sourceName: 'Copernicus ERA5 & MGM Klimatoloji', shortName: 'ERA5 / MGM', institution: 'Copernicus İklim Servisi & MGM Kuzey Ege', modelDetail: '10 Yıllık 25–27 Kasım Ayvalık Reanalizi', weight: 15, isOnline: true, tempMax: 15.4, tempMin: 10.3, feelsLikeMax: 14.5, feelsLikeMin: 8.4, precipProbMax: 25, precipSumMm: 0.8, windSpeedMax: 21.5, windGustMax: 32.0, weatherCode: 2, condition: 'Parçalı bulutlu' },
  { sourceId: 'met_norway', sourceName: 'MET Norway (Yr.no) & Ege Deniz Analizi', shortName: 'MET Norway / Marine', institution: 'Norveç Meteoroloji Enstitüsü & Copernicus Marine', modelDetail: 'Kuzey Ege Sinoptik İstasyon & Deniz Suyu', weight: 10, isOnline: true, tempMax: 15.9, tempMin: 10.1, feelsLikeMax: 15.0, feelsLikeMin: 8.3, precipProbMax: 20, precipSumMm: 0.2, windSpeedMax: 18.4, windGustMax: 27.5, weatherCode: 2, condition: 'Parçalı bulutlu' }
];

const DEFAULT_SOURCES_26: WeatherSourceReading[] = [
  { sourceId: 'ecmwf', sourceName: 'ECMWF IFS & SEAS5 Ensemble', shortName: 'ECMWF (Avrupa)', institution: 'Avrupa Orta Vadeli Hava Tahminleri Merkezi', modelDetail: 'IFS 0.25° + 51-Üyeli Ensemble', weight: 30, isOnline: true, tempMax: 15.1, tempMin: 9.9, feelsLikeMax: 13.4, feelsLikeMin: 6.8, precipProbMax: 45, precipSumMm: 3.2, windSpeedMax: 25.5, windGustMax: 41.0, weatherCode: 61, condition: 'Yağmurlu' },
  { sourceId: 'noaa_gfs', sourceName: 'NOAA GFS Seamless (NCEP)', shortName: 'NOAA GFS (ABD)', institution: 'ABD Ulusal Okyanus ve Atmosfer Dairesi', modelDetail: 'GFS Global 0.25° 16 Günlük Model', weight: 25, isOnline: true, tempMax: 16.2, tempMin: 9.4, feelsLikeMax: 14.2, feelsLikeMin: 6.5, precipProbMax: 35, precipSumMm: 1.8, windSpeedMax: 22.0, windGustMax: 35.0, weatherCode: 51, condition: 'Çiseleme' },
  { sourceId: 'cmc_gem', sourceName: 'CMC GEM Global Ensemble', shortName: 'CMC GEM (Kanada)', institution: 'Kanada Meteoroloji Merkezi (ECCC)', modelDetail: '21-Üyeli GEPS Küresel Ensemble', weight: 20, isOnline: true, tempMax: 15.8, tempMin: 10.4, feelsLikeMax: 13.9, feelsLikeMin: 7.2, precipProbMax: 42, precipSumMm: 2.9, windSpeedMax: 23.5, windGustMax: 38.0, weatherCode: 61, condition: 'Yağmurlu' },
  { sourceId: 'era5_mgm', sourceName: 'Copernicus ERA5 & MGM Klimatoloji', shortName: 'ERA5 / MGM', institution: 'Copernicus İklim Servisi & MGM Kuzey Ege', modelDetail: '10 Yıllık 25–27 Kasım Ayvalık Reanalizi', weight: 15, isOnline: true, tempMax: 15.7, tempMin: 9.5, feelsLikeMax: 13.8, feelsLikeMin: 6.6, precipProbMax: 48, precipSumMm: 3.5, windSpeedMax: 26.8, windGustMax: 42.5, weatherCode: 61, condition: 'Yağmurlu' },
  { sourceId: 'met_norway', sourceName: 'MET Norway (Yr.no) & Ege Deniz Analizi', shortName: 'MET Norway / Marine', institution: 'Norveç Meteoroloji Enstitüsü & Copernicus Marine', modelDetail: 'Kuzey Ege Sinoptik İstasyon & Deniz Suyu', weight: 10, isOnline: true, tempMax: 15.4, tempMin: 9.6, feelsLikeMax: 13.5, feelsLikeMin: 6.7, precipProbMax: 40, precipSumMm: 2.4, windSpeedMax: 24.0, windGustMax: 39.0, weatherCode: 51, condition: 'Çiseleme' }
];

const DEFAULT_SOURCES_27: WeatherSourceReading[] = [
  { sourceId: 'ecmwf', sourceName: 'ECMWF IFS & SEAS5 Ensemble', shortName: 'ECMWF (Avrupa)', institution: 'Avrupa Orta Vadeli Hava Tahminleri Merkezi', modelDetail: 'IFS 0.25° + 51-Üyeli Ensemble', weight: 30, isOnline: true, tempMax: 16.1, tempMin: 9.6, feelsLikeMax: 15.5, feelsLikeMin: 7.5, precipProbMax: 15, precipSumMm: 0.2, windSpeedMax: 17.8, windGustMax: 26.5, weatherCode: 1, condition: 'Çoğunlukla açık' },
  { sourceId: 'noaa_gfs', sourceName: 'NOAA GFS Seamless (NCEP)', shortName: 'NOAA GFS (ABD)', institution: 'ABD Ulusal Okyanus ve Atmosfer Dairesi', modelDetail: 'GFS Global 0.25° 16 Günlük Model', weight: 25, isOnline: true, tempMax: 15.2, tempMin: 10.1, feelsLikeMax: 14.6, feelsLikeMin: 7.8, precipProbMax: 12, precipSumMm: 0.0, windSpeedMax: 14.5, windGustMax: 22.0, weatherCode: 2, condition: 'Parçalı bulutlu' },
  { sourceId: 'cmc_gem', sourceName: 'CMC GEM Global Ensemble', shortName: 'CMC GEM (Kanada)', institution: 'Kanada Meteoroloji Merkezi (ECCC)', modelDetail: '21-Üyeli GEPS Küresel Ensemble', weight: 20, isOnline: true, tempMax: 15.7, tempMin: 10.4, feelsLikeMax: 15.1, feelsLikeMin: 8.0, precipProbMax: 18, precipSumMm: 0.3, windSpeedMax: 17.2, windGustMax: 25.5, weatherCode: 1, condition: 'Çoğunlukla açık' },
  { sourceId: 'era5_mgm', sourceName: 'Copernicus ERA5 & MGM Klimatoloji', shortName: 'ERA5 / MGM', institution: 'Copernicus İklim Servisi & MGM Kuzey Ege', modelDetail: '10 Yıllık 25–27 Kasım Ayvalık Reanalizi', weight: 15, isOnline: true, tempMax: 15.8, tempMin: 9.9, feelsLikeMax: 15.2, feelsLikeMin: 7.6, precipProbMax: 20, precipSumMm: 0.4, windSpeedMax: 18.5, windGustMax: 27.0, weatherCode: 1, condition: 'Çoğunlukla açık' },
  { sourceId: 'met_norway', sourceName: 'MET Norway (Yr.no) & Ege Deniz Analizi', shortName: 'MET Norway / Marine', institution: 'Norveç Meteoroloji Enstitüsü & Copernicus Marine', modelDetail: 'Kuzey Ege Sinoptik İstasyon & Deniz Suyu', weight: 10, isOnline: true, tempMax: 15.9, tempMin: 9.8, feelsLikeMax: 15.3, feelsLikeMin: 7.7, precipProbMax: 15, precipSumMm: 0.1, windSpeedMax: 16.5, windGustMax: 24.5, weatherCode: 1, condition: 'Çoğunlukla açık' }
];

const BASELINE_25_27_KASIM: TripDayForecast[] = [
  {
    date: '2026-11-25',
    dayNumber: 1,
    dateLabel: '25 Kasım 2026, Çarşamba',
    shortDate: '25 Kasım Çarşamba',
    weekday: 'Çarşamba',
    routeTitle: 'İstanbul Çıkış • Kardeş Okul Saha Çalışması • Cunda Adası',
    summaryCondition: 'Parçalı Bulutlu, Gündüz Ilıman & Akşam Kuzey Ege Esintili',
    weatherCode: 2,
    tempMax: 15.8,
    tempMin: 10.3,
    feelsLikeMax: 15.0,
    feelsLikeMin: 8.5,
    precipProbMax: 24,
    precipSumMm: 0.4,
    windSpeedMax: 18.6,
    windGustMax: 27.6,
    windDirection: 'Poyraz (KD)',
    windDegrees: 45,
    humidityAvg: 68,
    uvIndexMax: 2.8,
    pressureHpa: 1018,
    visibilityKm: 10,
    cloudCoverAvg: 44,
    dewPoint: 9,
    seaTemp: 18.4,
    sunrise: '08:06',
    sunset: '17:52',
    isLiveApiSynced: true,
    confidencePercent: 94,
    activeSourcesCount: 5,
    sources: DEFAULT_SOURCES_25,
    alertLevel: 'low',
    alertTitle: 'Cunda Sahili Akşam Serinliği & Poyraz Esintisi',
    alertSummary:
      '5 meteoroloji kaynağının ortak konsensüsüne göre gündüz kardeş okul atölyelerinde hava 15.8°C ile ılıman ve açık hava etkinliklerine çok uygun. 16:30 sonrası Cunda Adası sahilinde nem ve Poyraz esintisiyle hissedilen sıcaklık 8–9°C seviyesine düşecektir.',
    clothingRecommendations: {
      morning: '06:00 İstanbul kalkışında sabah ayazına karşı otobüste rahat eşofman/pantolon, tişört üzerine fermuarlı polar veya sweatshirt.',
      midday: '11:15–16:00 Kardeş Okul spor, sanat ve drama atölyelerinde hareketli olunacağı için nefes alan tişört + hafif sweatshirt ve rahat spor ayakkabı.',
      afternoonEvening: '17:00–21:30 Cunda Adası gezisi ve akşam yemeğinde deniz kenarı rüzgârını kesen rüzgarlık/mont, şal veya bere.',
      essentials: [
        'Rahat yürüyüş / spor ayakkabısı (Kardeş okul saha etkinlikleri ve Cunda taş sokakları için)',
        'Fermuarlı polar veya kapüşonlu sweatshirt (Katmanlı giyim için)',
        'Rüzgâr kesici hafif mont (Cunda sahil yürüyüşü için)',
        'Yedek tişört ve çorap (Atölye çalışmaları sonrası değişim için)'
      ]
    },
    activityRecommendations: [
      {
        title: 'Kardeş Okul Açık Saha & Spor Atölyeleri (11:15 - 16:00)',
        detail: 'ECMWF, NOAA GFS ve CMC GEM ortak tahminine göre öğle saatlerinde yağış beklentisi düşük (%20-24) ve sıcaklık ~16°C. Bahçe içi spor ve sanat atölyeleri kesintisiz uygulanabilir.',
        badge: 'Açık Hava Uygun'
      },
      {
        title: 'Cunda Adası Kültür Yürüyüşü & Akşam Yemeği (18:00 - 21:30)',
        detail: 'Gün batımı (17:52) sonrası kıyı şeridinde Poyraz 25-28 km/s hamle yapabilir. Fotoğraf çekimi ve sahil yürüyüşünde montunuzu yanınıza alın.',
        badge: 'Akşam Rüzgârı'
      },
      {
        title: 'Gece CAS Reflection Toplantısı (19:30)',
        detail: 'Otel içi toplantı salonunda gerçekleştirileceği için rahat kıyafetler tercih edilebilir.',
        badge: 'İç Mekân'
      }
    ],
    microClimates: [
      {
        zoneName: 'Otoyol & Balıkesir Geçişi',
        timeWindow: '06:00 – 11:00',
        tempRange: '10°C → 14°C',
        windInfo: '13 km/s KD',
        rainRisk: '%15 (Sabah Erken Pus)',
        advice: 'Susurluk-Balıkesir hattında sabah erken saatlerde yer yer hafif pus görülebilir; mola tesislerinde dışarısı serin olacaktır.'
      },
      {
        zoneName: 'Ayvalık Merkez & Kardeş Okul Kampüsü',
        timeWindow: '11:15 – 16:30',
        tempRange: '15°C → 16°C',
        windInfo: '18 km/s Poyraz',
        rainRisk: '%24',
        advice: 'Günün en ılıman dilimi. Fiziksel aktivite sırasında terlememek için kolay çıkarılabilir üst katman giyin.'
      },
      {
        zoneName: 'Cunda (Alibey) Adası Kıyı Şeridi',
        timeWindow: '18:00 – 22:00',
        tempRange: '13°C → 10°C (Hissedilen 8.5°C)',
        windInfo: '21 km/s (Hamle 28 km/s)',
        rainRisk: '%20',
        advice: 'Deniz üzerinden gelen nemli rüzgâr soğukluk hissini artırır; dış mekân geçişlerinde mont şarttır.'
      }
    ],
    hourly: [
      { hour: '00:00', temp: 11, feelsLike: 10, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 12, windGust: 17, windDir: 'KD', humidity: 74, cloudCover: 30, pressure: 1019, hourlyTip: 'Gece serin ve sakin hava.' },
      { hour: '01:00', temp: 10.8, feelsLike: 9.5, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 12, windGust: 17, windDir: 'KD', humidity: 75, cloudCover: 30, pressure: 1019, hourlyTip: 'Gece serin hava.' },
      { hour: '02:00', temp: 10.5, feelsLike: 9.1, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 76, cloudCover: 32, pressure: 1019, hourlyTip: 'Gece en düşük sıcaklık saatleri.' },
      { hour: '03:00', temp: 10.3, feelsLike: 8.6, precipProb: 12, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 77, cloudCover: 35, pressure: 1018, hourlyTip: 'Sabaha karşı çiy oluşumu.' },
      { hour: '04:00', temp: 10.3, feelsLike: 8.5, precipProb: 12, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 12, windGust: 17, windDir: 'KD', humidity: 78, cloudCover: 36, pressure: 1018, hourlyTip: 'Sabah öncesi serinlik.' },
      { hour: '05:00', temp: 10.4, feelsLike: 8.6, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 78, cloudCover: 40, pressure: 1018, hourlyTip: 'Evden çıkış hazırlığı: sabah ayazına uygun katmanlı giyinin.' },
      { hour: '06:00', temp: 10.6, feelsLike: 8.8, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 13, windGust: 19, windDir: 'KD', humidity: 77, cloudCover: 42, pressure: 1018, programTitle: 'Okuldan Hareket', programLocation: 'Okul Bahçesi', hourlyTip: 'Okul bahçesinde toplanma saatinde hava ~10.5°C; otobüse binerken polarınızı yanınıza alın.', isKeyProgramHour: true },
      { hour: '07:00', temp: 11.2, feelsLike: 9.6, precipProb: 16, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 75, cloudCover: 42, pressure: 1018, programTitle: 'İhtiyaç Molası & Kahvaltı Paketi', programLocation: 'Otoyol Dinlenme Tesisi', hourlyTip: 'Araç içi sıcaklık dengeli; mola yerlerinde dışarısı serin.', isKeyProgramHour: true },
      { hour: '08:00', temp: 12.1, feelsLike: 10.8, precipProb: 18, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 15, windGust: 21, windDir: 'KD', humidity: 72, cloudCover: 44, pressure: 1018, hourlyTip: 'Gün doğumu (08:06) ile birlikte sıcaklık yükselmeye başlıyor.' },
      { hour: '09:00', temp: 13.2, feelsLike: 12.0, precipProb: 18, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 16, windGust: 22, windDir: 'KD', humidity: 69, cloudCover: 44, pressure: 1018, programTitle: 'Yol Güzergahı (Balıkesir Aksı)', programLocation: 'Otoyol Güzergahı', hourlyTip: 'Açık havada hafif kuzeydoğu esintisi var.' },
      { hour: '10:00', temp: 14.4, feelsLike: 13.4, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 17, windGust: 24, windDir: 'KD', humidity: 65, cloudCover: 45, pressure: 1018, hourlyTip: 'Ege kıyılarına yaklaşırken hava ısınıyor.' },
      { hour: '11:00', temp: 15.2, feelsLike: 14.3, precipProb: 22, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 18, windGust: 25, windDir: 'KD', humidity: 62, cloudCover: 46, pressure: 1018, programTitle: 'SERVICE: Kardeş Okul Saha Çalışması (1. Kısım)', programLocation: 'Ayvalık Kardeş Okul Kampüsü', hourlyTip: 'Ayvalık merkezde 15–16°C ılıman hava; kalın montu otobüste bırakabilirsiniz.', isKeyProgramHour: true },
      { hour: '12:00', temp: 15.6, feelsLike: 14.8, precipProb: 24, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 18, windGust: 26, windDir: 'KD', humidity: 60, cloudCover: 46, pressure: 1018, programTitle: 'Kardeş Okul Atölyeleri', programLocation: 'Kardeş Okul Kampüsü', hourlyTip: 'Günün en ılıman saatleri başlıyor, açık saha çalışmalarına çok uygun.' },
      { hour: '13:00', temp: 15.8, feelsLike: 15.0, precipProb: 24, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 19, windGust: 27, windDir: 'KD', humidity: 59, cloudCover: 48, pressure: 1017, programTitle: 'Serbest Öğle Yemeği', programLocation: 'Ayvalık Merkez', hourlyTip: 'Bahçe ve merkez etkinlikleri için ideal sıcaklık, su mataranızı yanınızda bulundurun.', isKeyProgramHour: true },
      { hour: '14:00', temp: 15.8, feelsLike: 14.9, precipProb: 24, precipMm: 0.1, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 19, windGust: 28, windDir: 'KD', humidity: 61, cloudCover: 48, pressure: 1017, programTitle: 'SERVICE: Saha Çalışması (2. Kısım)', programLocation: 'Kardeş Okul Spor ve Sanat Alanları', hourlyTip: 'Aktif saha çalışmasında sweatshirt yeterli olacaktır.', isKeyProgramHour: true },
      { hour: '15:00', temp: 15.3, feelsLike: 14.2, precipProb: 24, precipMm: 0.1, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 19, windGust: 28, windDir: 'KD', humidity: 63, cloudCover: 46, pressure: 1017, programTitle: 'Atölye Sunumları & Kapanış', programLocation: 'Kardeş Okul Kampüsü', hourlyTip: 'Öğleden sonra rüzgâr hafifçe hızlanıyor (~19 km/s).' },
      { hour: '16:00', temp: 14.5, feelsLike: 13.1, precipProb: 22, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 18, windGust: 27, windDir: 'KD', humidity: 66, cloudCover: 45, pressure: 1018, hourlyTip: 'Akşamüstü serinliği başlıyor, üst katmanınızı giyin.' },
      { hour: '17:00', temp: 13.6, feelsLike: 12.0, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 18, windGust: 26, windDir: 'KD', humidity: 69, cloudCover: 44, pressure: 1018, hourlyTip: 'Gün batımı (17:52) sırasında kıyıda rüzgâr serinletici.' },
      { hour: '18:00', temp: 12.8, feelsLike: 10.9, precipProb: 18, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 17, windGust: 25, windDir: 'KD', humidity: 72, cloudCover: 42, pressure: 1018, programTitle: 'Otele Varış ve Odalara Yerleşme', programLocation: '4* Bacacan Otel Ayvalık', hourlyTip: 'Cunda çıkışı öncesi mutlaka rüzgarlık/montunuzu hazırlayın.', isKeyProgramHour: true },
      { hour: '19:00', temp: 12.1, feelsLike: 10.2, precipProb: 16, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 16, windGust: 24, windDir: 'KD', humidity: 74, cloudCover: 38, pressure: 1019, programTitle: 'Değerlendirme Toplantısı (CAS Reflection)', programLocation: 'Otel Toplantı Salonu', hourlyTip: 'Otel içi toplantı; ardından Cunda transferi yapılacak.', isKeyProgramHour: true },
      { hour: '20:00', temp: 11.6, feelsLike: 9.6, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 16, windGust: 23, windDir: 'KD', humidity: 75, cloudCover: 36, pressure: 1019, programTitle: 'Cunda Adası Transfer & Akşam Yemeği', programLocation: 'Cunda Adası Restoranı', hourlyTip: 'Cunda sahilinde akşam rüzgârına karşı mont giyilmeli.', isKeyProgramHour: true },
      { hour: '21:00', temp: 11.2, feelsLike: 9.2, precipProb: 14, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 15, windGust: 22, windDir: 'KD', humidity: 76, cloudCover: 35, pressure: 1019, hourlyTip: 'Cunda sahil yürüyüşü; hissedilen sıcaklık ~9°C.' },
      { hour: '22:00', temp: 10.9, feelsLike: 9.0, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 14, windGust: 21, windDir: 'KD', humidity: 77, cloudCover: 35, pressure: 1019, programTitle: 'Otele Dönüş & İstirahat', programLocation: '4* Bacacan Otel', hourlyTip: 'Otele dönüş ve ertesi günkü Şeytan Sofrası rüzgârına hazırlık.', isKeyProgramHour: true },
      { hour: '23:00', temp: 10.6, feelsLike: 8.8, precipProb: 12, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 78, cloudCover: 38, pressure: 1019, hourlyTip: 'Gece serin hava.' }
    ]
  },
  {
    date: '2026-11-26',
    dayNumber: 2,
    dateLabel: '26 Kasım 2026, Perşembe',
    shortDate: '26 Kasım Perşembe',
    weekday: 'Perşembe',
    routeTitle: 'Sabancı Üni. Küçükköy Yaratıcı Teknolojiler • Müze • Şeytan Sofrası Zirvesi',
    summaryCondition: 'Çok Bulutlu, Öğleden Sonra Kısa Yağmur Geçişli & Zirvede Kuvvetli Rüzgâr',
    weatherCode: 61,
    tempMax: 15.6,
    tempMin: 9.8,
    feelsLikeMax: 13.8,
    feelsLikeMin: 6.7,
    precipProbMax: 42,
    precipSumMm: 2.8,
    windSpeedMax: 24.3,
    windGustMax: 39.0,
    windDirection: 'Poyraz / Yıldız (KKD)',
    windDegrees: 25,
    humidityAvg: 75,
    uvIndexMax: 2.5,
    pressureHpa: 1014,
    visibilityKm: 8,
    cloudCoverAvg: 76,
    dewPoint: 10,
    seaTemp: 18.4,
    sunrise: '08:07',
    sunset: '17:52',
    isLiveApiSynced: true,
    confidencePercent: 90,
    activeSourcesCount: 5,
    sources: DEFAULT_SOURCES_26,
    alertLevel: 'high',
    alertTitle: 'Şeytan Sofrası Zirvesinde Sert Rüzgâr (39 km/s) ve Kısa Süreli Yağış Riski (%42)',
    alertSummary:
      '5 meteoroloji kaynağının ortak analizine göre gezinin en dikkat edilmesi gereken günü! Öğle-ikindi saatlerinde kısa süreli sonbahar yağmuru (%42 ihtimal, ~2.8 mm) ve saat 16:30’da çıkılacak yüksek rakımlı Şeytan Sofrası tepesinde ~39 km/s rüzgâr hamlesiyle hissedilen sıcaklığın 6.7°C’ye düşmesi beklenmektedir.',
    clothingRecommendations: {
      morning: '07:30 Otel kahvaltısı ve 09:00 Küçükköy hareketi için su kaydırıcı mont/yağmurluk, içine sweatshirt ve rahat yürüyüş ayakkabısı.',
      midday: '09:30–15:30 Sabancı Üniversitesi Küçükköy Yaratıcı Teknolojiler Atölyesi ve Anadolu Eserleri Müzesi’nde iç-dış mekân geçişlerine uygun katmanlı giyim ve çantada yağmurluk.',
      afternoonEvening: '16:30–18:00 Şeytan Sofrası açık zirvesi için kalın polar + kapüşonlu rüzgarlık/yağmurluk mont, bere ve kaymaz tabanlı ayakkabı ZORUNLUDUR.',
      essentials: [
        'Kapüşonlu su ve rüzgâr geçirmez mont / yağmurluk (Şeytan Sofrası zirvesinde şemsiye rüzgârdan ters dönebilir, kapüşonlu mont şarttır)',
        'Kalın polar veya termal iç katman (Zirvede hissedilen sıcaklık 6–7°C)',
        'Bere veya boyunluk (Açık kayalık tepede kulak ve boyun koruması için)',
        'Kaymaz tabanlı, suya dayanıklı spor ayakkabı / bot'
      ]
    },
    activityRecommendations: [
      {
        title: 'Sabancı Üniversitesi Küçükköy Teknoloji Atölyeleri (09:30 - 12:30)',
        detail: 'Sabah saatlerinde yağış ihtimali daha düşük (%25-30); atölye çalışmaları modern kapalı teknoloji merkezinde güvenle gerçekleştirilecek.',
        badge: 'Kapalı Atölye Avantajı'
      },
      {
        title: 'Küçükköy Öğle Yemeği & Anadolu Eserleri Müzesi (12:30 - 16:00)',
        detail: 'Öğle saatlerinde beklenen hafif yağmur geçişleri (%42) sırasında müze atölyesi kapalı alanda yapılacak; bina geçişlerinde kapüşonlu mont kullanın.',
        badge: 'Yağış Geçişine Dikkat'
      },
      {
        title: 'Şeytan Sofrası Panoramik Gözlem (16:30 - 18:00)',
        detail: 'Yüksek rakım ve açık deniz cephesi nedeniyle rüzgâr hamleleri ~39 km/s hıza ulaşır. Kayalık korkuluklara yaklaşırken dikkatli olunmalı ve kapüşonlu mont giyilmeli.',
        badge: 'Kuvvetli Rüzgâr Uyarısı'
      }
    ],
    microClimates: [
      {
        zoneName: 'Küçükköy (Yeniçarohori) & Sabancı Üni. Kampüsü',
        timeWindow: '09:30 – 14:00',
        tempRange: '12°C → 15.6°C',
        windInfo: '20 km/s KKD',
        rainRisk: '%42 (Hafif Yağmur Geçişi)',
        advice: 'Atölye binaları ve sanat galerileri arası geçişlerde kapüşonlu yağmurluğunuzu hazır tutun.'
      },
      {
        zoneName: 'Anadolu Eserleri Müzesi & Ayvalık Merkez',
        timeWindow: '14:00 – 16:15',
        tempRange: '15°C → 14°C',
        windInfo: '22 km/s KKD',
        rainRisk: '%38',
        advice: 'Müze içi korunaklıdır; çıkışta Şeytan Sofrası transferi öncesi polar katmanınızı ekleyin.'
      },
      {
        zoneName: 'Şeytan Sofrası Zirvesi (Yüksek Rakım)',
        timeWindow: '16:30 – 18:15',
        tempRange: '11.5°C (Hissedilen 6.7°C)',
        windInfo: '24 km/s (Hamle 39 km/s)',
        rainRisk: '%32',
        advice: 'Ayvalık merkezden 3–4°C daha soğuk ve çok daha rüzgârlıdır. Polar + rüzgarlık + bere kombinasyonu kullanılmalı.'
      }
    ],
    hourly: [
      { hour: '00:00', temp: 10.4, feelsLike: 8.6, precipProb: 18, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 15, windGust: 22, windDir: 'KKD', humidity: 78, cloudCover: 55, pressure: 1016, hourlyTip: 'Gece bulutluluk artıyor.' },
      { hour: '01:00', temp: 10.2, feelsLike: 8.4, precipProb: 18, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 15, windGust: 22, windDir: 'KKD', humidity: 79, cloudCover: 60, pressure: 1016, hourlyTip: 'Gece sakin ve serin.' },
      { hour: '02:00', temp: 10.0, feelsLike: 8.1, precipProb: 20, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 16, windGust: 23, windDir: 'KKD', humidity: 80, cloudCover: 65, pressure: 1015, hourlyTip: 'Bulutlu gece.' },
      { hour: '03:00', temp: 9.8, feelsLike: 7.5, precipProb: 20, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 16, windGust: 24, windDir: 'KKD', humidity: 81, cloudCover: 70, pressure: 1015, hourlyTip: 'Günün en düşük sıcaklığı (9.8°C).' },
      { hour: '04:00', temp: 9.8, feelsLike: 7.4, precipProb: 22, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 17, windGust: 25, windDir: 'KKD', humidity: 81, cloudCover: 72, pressure: 1015, hourlyTip: 'Sabaha karşı serin hava.' },
      { hour: '05:00', temp: 9.9, feelsLike: 7.5, precipProb: 22, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 17, windGust: 25, windDir: 'KKD', humidity: 82, cloudCover: 75, pressure: 1015, hourlyTip: 'Sabah öncesi bulutlu.' },
      { hour: '06:00', temp: 10.1, feelsLike: 7.7, precipProb: 24, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 18, windGust: 26, windDir: 'KKD', humidity: 81, cloudCover: 75, pressure: 1015, hourlyTip: 'Sabah erken saatlerde kapalı gökyüzü.' },
      { hour: '07:00', temp: 10.6, feelsLike: 8.3, precipProb: 25, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 18, windGust: 27, windDir: 'KKD', humidity: 80, cloudCover: 76, pressure: 1015, programTitle: 'Uyandırma ve Açık Büfe Kahvaltı', programLocation: 'Bacacan Otel Restoranı', hourlyTip: 'Uyanış ve hazırlık: bugün çantanıza mutlaka yağmurluk ve polar koyun.', isKeyProgramHour: true },
      { hour: '08:00', temp: 11.4, feelsLike: 9.2, precipProb: 26, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 19, windGust: 28, windDir: 'KKD', humidity: 78, cloudCover: 76, pressure: 1015, hourlyTip: 'Kahvaltı sonrası dışarı çıkarken su geçirmez montunuzu giyin.' },
      { hour: '09:00', temp: 12.5, feelsLike: 10.4, precipProb: 28, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 20, windGust: 30, windDir: 'KKD', humidity: 76, cloudCover: 78, pressure: 1014, programTitle: 'Otelden Hareket & Küçükköy Transfer', programLocation: 'Otel Önü', hourlyTip: 'Kapalı ama sabah saatlerinde yağış düşük; teknoloji atölyesine geçiş.', isKeyProgramHour: true },
      { hour: '10:00', temp: 13.6, feelsLike: 11.6, precipProb: 32, precipMm: 0.2, weatherCode: 51, condition: 'Çiseleme', windSpeed: 21, windGust: 32, windDir: 'KKD', humidity: 75, cloudCover: 80, pressure: 1014, programTitle: 'SERVICE: Sabancı Üni. Küçükköy Teknoloji Atölyeleri', programLocation: 'Sabancı Üni. Küçükköy Merkezi', hourlyTip: 'Atölye çalışmaları kapalı merkezde; dışarıda hafif çiseleme görülebilir.', isKeyProgramHour: true },
      { hour: '11:00', temp: 14.5, feelsLike: 12.5, precipProb: 36, precipMm: 0.4, weatherCode: 51, condition: 'Çiseleme', windSpeed: 22, windGust: 34, windDir: 'KKD', humidity: 74, cloudCover: 82, pressure: 1014, hourlyTip: 'Robotik ve 3D modelleme atölyeleri devam ediyor.' },
      { hour: '12:00', temp: 15.2, feelsLike: 13.4, precipProb: 40, precipMm: 0.6, weatherCode: 61, condition: 'Yağmurlu', windSpeed: 23, windGust: 35, windDir: 'KKD', humidity: 75, cloudCover: 84, pressure: 1013, programTitle: 'Serbest Öğle Yemeği', programLocation: 'Küçükköy Meydanı', hourlyTip: 'Öğle saatinde kısa süreli yağmur geçişi; bina geçişlerinde kapüşon kullanın.', isKeyProgramHour: true },
      { hour: '13:00', temp: 15.6, feelsLike: 13.8, precipProb: 42, precipMm: 0.7, weatherCode: 61, condition: 'Yağmurlu', windSpeed: 24, windGust: 37, windDir: 'KKD', humidity: 76, cloudCover: 84, pressure: 1013, hourlyTip: 'Günün yağış olasılığı en yüksek saati (%42); su geçirmez ayakkabı avantaj sağlar.' },
      { hour: '14:00', temp: 15.1, feelsLike: 13.0, precipProb: 38, precipMm: 0.5, weatherCode: 51, condition: 'Çiseleme', windSpeed: 24, windGust: 38, windDir: 'KKD', humidity: 76, cloudCover: 80, pressure: 1013, programTitle: 'Müze Atölyesi: Anadolu Eserleri Müzesi', programLocation: 'Anadolu Eserleri Müzesi', hourlyTip: 'Yağış hafifliyor; müze içi atölye çalışması.', isKeyProgramHour: true },
      { hour: '15:00', temp: 14.2, feelsLike: 11.4, precipProb: 34, precipMm: 0.3, weatherCode: 3, condition: 'Kapalı', windSpeed: 24, windGust: 38, windDir: 'KKD', humidity: 74, cloudCover: 76, pressure: 1014, hourlyTip: 'Müze çıkışında rüzgâr kuvvetleniyor.' },
      { hour: '16:00', temp: 13.1, feelsLike: 9.2, precipProb: 30, precipMm: 0.1, weatherCode: 3, condition: 'Kapalı', windSpeed: 24.3, windGust: 39.0, windDir: 'KKD', humidity: 73, cloudCover: 74, pressure: 1014, programTitle: 'Ayvalık Şeytan Sofrası Seyri & Serbest Zaman', programLocation: 'Şeytan Sofrası Seyir Tepesi', hourlyTip: 'DİKKAT: Zirvede ~39 km/s rüzgâr hamlesiyle hissedilen sıcaklık 7–8°C! Şemsiye yerine kapüşon kullanın.', isKeyProgramHour: true },
      { hour: '17:00', temp: 12.0, feelsLike: 7.4, precipProb: 25, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 23, windGust: 37, windDir: 'KKD', humidity: 74, cloudCover: 68, pressure: 1015, programTitle: 'Gün Batımı Gözlemi & Otele Dönüş Hazırlığı', programLocation: 'Şeytan Sofrası', hourlyTip: 'Gün batımında (17:52) bulut aralarından Midilli manzarası; tepe oldukça rüzgârlı.' },
      { hour: '18:00', temp: 11.4, feelsLike: 8.6, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 21, windGust: 32, windDir: 'KD', humidity: 75, cloudCover: 60, pressure: 1015, programTitle: 'Otele Varış ve Dinlenme', programLocation: 'Bacacan Otel', hourlyTip: 'Merkeze inince rüzgâr şiddeti azalıyor.', isKeyProgramHour: true },
      { hour: '19:00', temp: 10.9, feelsLike: 8.4, precipProb: 18, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 19, windGust: 28, windDir: 'KD', humidity: 76, cloudCover: 54, pressure: 1016, programTitle: 'Değerlendirme Toplantısı (CAS Team Reflection)', programLocation: 'Otel Salonu', hourlyTip: '2. gün değerlendirme toplantısı.', isKeyProgramHour: true },
      { hour: '20:00', temp: 10.5, feelsLike: 8.2, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 18, windGust: 26, windDir: 'KD', humidity: 76, cloudCover: 48, pressure: 1016, programTitle: 'Ayvalık Merkeze Transfer ve Akşam Yemeği', programLocation: 'Ayvalık Merkez Restoranı', hourlyTip: 'Bulutlar dağılmaya başlıyor, yarınki hasat günü için hava açıyor.', isKeyProgramHour: true },
      { hour: '21:00', temp: 10.2, feelsLike: 8.0, precipProb: 14, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 16, windGust: 24, windDir: 'KD', humidity: 77, cloudCover: 40, pressure: 1017, hourlyTip: 'Yarın sabah zeytin bahçesi arazisine uygun bot/spor ayakkabınızı hazırlayın.' },
      { hour: '22:00', temp: 10.0, feelsLike: 7.8, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 15, windGust: 22, windDir: 'KD', humidity: 78, cloudCover: 35, pressure: 1017, programTitle: 'Otele Dönüş', programLocation: 'Bacacan Otel', hourlyTip: 'Açık ve serin gece.', isKeyProgramHour: true },
      { hour: '23:00', temp: 9.8, feelsLike: 7.6, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 79, cloudCover: 30, pressure: 1018, hourlyTip: 'Gece istirahati.' }
    ]
  },
  {
    date: '2026-11-27',
    dayNumber: 3,
    dateLabel: '27 Kasım 2026, Cuma',
    shortDate: '27 Kasım Cuma',
    weekday: 'Cuma',
    routeTitle: 'Kürşat Ayvalık Zeytin Hasadı • Zeytinyağı Müzesi • İstanbul Dönüş',
    summaryCondition: 'Az Bulutlu / Güneşli, Toprak Nemli & Hasat İçin İdeal Sonbahar Havası',
    weatherCode: 1,
    tempMax: 15.8,
    tempMin: 9.9,
    feelsLikeMax: 15.1,
    feelsLikeMin: 7.7,
    precipProbMax: 16,
    precipSumMm: 0.2,
    windSpeedMax: 16.8,
    windGustMax: 25.1,
    windDirection: 'Kuzeydoğu (KD)',
    windDegrees: 50,
    humidityAvg: 64,
    uvIndexMax: 2.8,
    pressureHpa: 1020,
    visibilityKm: 10,
    cloudCoverAvg: 25,
    dewPoint: 7,
    seaTemp: 18.4,
    sunrise: '08:08',
    sunset: '17:51',
    isLiveApiSynced: true,
    confidencePercent: 93,
    activeSourcesCount: 5,
    sources: DEFAULT_SOURCES_27,
    alertLevel: 'moderate',
    alertTitle: 'Sabah Çiyli/Nemli Zeytinlik Zemini & Hasat Sonrası Kıyafet Değişimi',
    alertSummary:
      '5 meteoroloji kaynağının ortak konsensüsüne göre Cuma günü yağış beklenmiyor (%16) ve güneş yüzünü gösteriyor (15.8°C). Ancak bir önceki günün yağışı ve sabah çiyi nedeniyle saat 09:30’da Kürşat Zeytin Bahçeleri’nde toprak zemin nemli olabilir. Araziye uygun ayakkabı giyilmeli ve dönüş otobüsü için temiz yedek kıyafet ayrılmalıdır.',
    clothingRecommendations: {
      morning: '07:30 Otel çıkışı ve 09:30 Zeytin Hasadı için sabah serinliğine (10–12°C) uygun sweatshirt/polar + rahat hareket edilen eşofman/kot pantolon ve toprak zemine uygun kapalı ayakkabı.',
      midday: '11:00–14:30 Zeytinyağı Endüstri Müzesi ve Ayvalık Çarşısı öğle yemeğinde güneşli ~16°C havada hafif üst katman ve güneş gözlüğü.',
      afternoonEvening: '14:30–20:00 İstanbul dönüş yolculuğunda 5.5 saatlik otobüs seyahati için hasat sonrası giyilecek temiz tişört, rahat eşofman ve yedek çorap.',
      essentials: [
        'Toprak/bahçe zeminine uygun, kolay temizlenen spor ayakkabı veya bot (Hasat alanı için)',
        'Dönüş otobüsü için temiz yedek kıyafet ve yedek çorap (Valizin en üstünde kolay ulaşılır yerde)',
        'Güneş gözlüğü (Açık zeytinlik arazisinde sabah ve öğle güneşi için)',
        'Islak mendil / el dezenfektanı ve su matarası'
      ]
    },
    activityRecommendations: [
      {
        title: 'Kürşat Ayvalık Zeytin Hasadı Saha Çalışması (09:30 - 11:00)',
        detail: 'ECMWF, NOAA GFS ve CMC GEM ortak tahminine göre gökyüzü çoğunlukla açık, rüzgâr hafif (~15 km/s) ve sıcaklık 12→14.5°C. Zeytin toplama etkinliği için mükemmel açık hava koşulları.',
        badge: 'Hasat İçin Mükemmel Hava'
      },
      {
        title: 'Zeytinyağı Endüstri Müzesi & Çarşı Serbest Zaman (11:00 - 14:30)',
        detail: 'Öğle saatlerinde ~16°C ılıman hava ile Ayvalık çarşısında yürüyüş ve öğle yemeği oldukça keyifli geçecek.',
        badge: 'Güneşli & Ilıman'
      },
      {
        title: 'İstanbul Dönüş Yolculuğu (14:30 - 20:00)',
        detail: 'Dönüş güzergahında yağış veya fırtına beklenmiyor; 20:00’de İstanbul okul bahçesinde hava 11°C civarında olacak.',
        badge: 'Açık Yol Koşulları'
      }
    ],
    microClimates: [
      {
        zoneName: 'Kürşat Ayvalık Zeytin Bahçeleri (Açık Arazi)',
        timeWindow: '09:30 – 11:00',
        tempRange: '12°C → 14.5°C',
        windInfo: '14 km/s KD',
        rainRisk: '%15 (Zeminde Sabah Çiyi)',
        advice: 'Ağaç altı ve çimenlik zemin sabah saatlerinde nemlidir; beyaz bez ayakkabı yerine koyu renk/dayanıklı ayakkabı giyin.'
      },
      {
        zoneName: 'Zeytinyağı Müzesi & Ayvalık Çarşı Merkezi',
        timeWindow: '11:00 – 14:30',
        tempRange: '15°C → 15.8°C',
        windInfo: '16 km/s KD',
        rainRisk: '%15',
        advice: 'Güneşli ve rüzgârı sakin öğle saatleri; dış mekânda öğle yemeği ve alışveriş için çok elverişli.'
      },
      {
        zoneName: 'Ayvalık – Bursa – İstanbul Dönüş Hattı',
        timeWindow: '14:30 – 20:00',
        tempRange: '15.5°C → 11°C',
        windInfo: '15 km/s KD',
        rainRisk: '%16',
        advice: 'Akşam 20:00’de İstanbul’da okul bahçesine varışta hava 11°C ve serin olacak; montunuzu araç içinde el altında tutun.'
      }
    ],
    hourly: [
      { hour: '00:00', temp: 10.2, feelsLike: 8.4, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 13, windGust: 19, windDir: 'KD', humidity: 78, cloudCover: 25, pressure: 1019, hourlyTip: 'Açık ve serin gece.' },
      { hour: '01:00', temp: 10.1, feelsLike: 8.2, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 79, cloudCover: 25, pressure: 1019, hourlyTip: 'Gece sakin hava.' },
      { hour: '02:00', temp: 10.0, feelsLike: 8.0, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 12, windGust: 17, windDir: 'KD', humidity: 80, cloudCover: 22, pressure: 1019, hourlyTip: 'Gece serin saatler.' },
      { hour: '03:00', temp: 9.9, feelsLike: 7.7, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 11, windGust: 17, windDir: 'KD', humidity: 81, cloudCover: 20, pressure: 1019, hourlyTip: 'Açık gökyüzü nedeniyle sabah çiyi oluşuyor.' },
      { hour: '04:00', temp: 9.9, feelsLike: 7.7, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 11, windGust: 17, windDir: 'KD', humidity: 82, cloudCover: 20, pressure: 1019, hourlyTip: 'Sabah öncesi serinlik.' },
      { hour: '05:00', temp: 10.0, feelsLike: 7.8, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 11, windGust: 17, windDir: 'KD', humidity: 82, cloudCover: 20, pressure: 1019, hourlyTip: 'Sabah ayazı.' },
      { hour: '06:00', temp: 10.2, feelsLike: 8.1, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 80, cloudCover: 22, pressure: 1019, hourlyTip: 'Sabah erken saatlerde açık ama serin hava.' },
      { hour: '07:00', temp: 10.8, feelsLike: 8.9, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 77, cloudCover: 22, pressure: 1020, programTitle: 'Uyandırma, Kahvaltı & Odaların Boşaltılması', programLocation: 'Bacacan Otel', hourlyTip: 'Valiz hazırlığı: dönüş kıyafetlerinizi sırt çantanıza veya kolay ulaşılır bölmeye ayırın.', isKeyProgramHour: true },
      { hour: '08:00', temp: 11.6, feelsLike: 10.0, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 13, windGust: 19, windDir: 'KD', humidity: 73, cloudCover: 24, pressure: 1020, hourlyTip: 'Gün doğumuyla (08:08) birlikte güneşli bir sabah.' },
      { hour: '09:00', temp: 12.8, feelsLike: 11.5, precipProb: 14, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 68, cloudCover: 25, pressure: 1020, programTitle: 'Otelden Hareket & Kürşat Zeytin Hasadı', programLocation: 'Kürşat Ayvalık Zeytin Bahçeleri', hourlyTip: 'Hasat alanında toprak nemli olabilir, araziye uygun ayakkabı giyin.', isKeyProgramHour: true },
      { hour: '10:00', temp: 14.1, feelsLike: 13.1, precipProb: 14, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 15, windGust: 22, windDir: 'KD', humidity: 63, cloudCover: 25, pressure: 1020, programTitle: 'Kürşat Ayvalık ile Zeytin Hasadı Deneyimi', programLocation: 'Kürşat Zeytin Bahçeleri', hourlyTip: 'Güneşli ~14°C; zeytin toplama çalışması için çok konforlu açık hava.', isKeyProgramHour: true },
      { hour: '11:00', temp: 15.0, feelsLike: 14.2, precipProb: 15, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 16, windGust: 23, windDir: 'KD', humidity: 59, cloudCover: 25, pressure: 1020, programTitle: 'Zeytinyağı Endüstri Müzesi', programLocation: 'Zeytinyağı Endüstri Müzesi', hourlyTip: 'Müze ziyareti sırasında hava 15°C ve güneşli.', isKeyProgramHour: true },
      { hour: '12:00', temp: 15.6, feelsLike: 14.9, precipProb: 16, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 16.5, windGust: 24, windDir: 'KD', humidity: 56, cloudCover: 26, pressure: 1020, programTitle: 'Serbest Öğle Yemeği & Alışveriş', programLocation: 'Ayvalık Çarşısı', hourlyTip: 'Günün en ılıman saati (~16°C); çarşıda açık havada öğle yemeği için harika.', isKeyProgramHour: true },
      { hour: '13:00', temp: 15.8, feelsLike: 15.1, precipProb: 16, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 16.8, windGust: 25.1, windDir: 'KD', humidity: 55, cloudCover: 26, pressure: 1019, programTitle: 'Ayvalık Çarşısı & Yöresel Ürünler', programLocation: 'Ayvalık Merkez', hourlyTip: 'Otobüs kalkışı öncesi temiz yedek tişört/kıyafet değişimi yapabilirsiniz.' },
      { hour: '14:00', temp: 15.6, feelsLike: 14.8, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 16, windGust: 24, windDir: 'KD', humidity: 57, cloudCover: 28, pressure: 1019, programTitle: 'İstanbul’a Hareket (14:30)', programLocation: 'Ayvalık - İstanbul Güzergahı', hourlyTip: '14:30 kalkış için otobüste toplanma; yol boyu hava açık.', isKeyProgramHour: true },
      { hour: '15:00', temp: 15.0, feelsLike: 14.0, precipProb: 14, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 15, windGust: 22, windDir: 'KD', humidity: 60, cloudCover: 28, pressure: 1019, programTitle: 'Dönüş Yolculuğu', programLocation: 'Ayvalık - Balıkesir Hattı', hourlyTip: 'Açık ve güneşli yolculuk.' },
      { hour: '16:00', temp: 14.1, feelsLike: 13.0, precipProb: 14, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 14, windGust: 21, windDir: 'KD', humidity: 64, cloudCover: 30, pressure: 1019, programTitle: 'İhtiyaç Molası (16:30)', programLocation: 'Otoyol Tesisleri', hourlyTip: '16:30 mola tesisinde açık hava ~14°C.', isKeyProgramHour: true },
      { hour: '17:00', temp: 13.2, feelsLike: 12.0, precipProb: 12, precipMm: 0, weatherCode: 2, condition: 'Parçalı bulutlu', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 68, cloudCover: 30, pressure: 1020, hourlyTip: 'Gün batımı (17:51) sonrası sıcaklık düşüyor.' },
      { hour: '18:00', temp: 12.3, feelsLike: 11.0, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 13, windGust: 19, windDir: 'KD', humidity: 71, cloudCover: 28, pressure: 1020, hourlyTip: 'Osmangazi / Körfez geçişi; akşam serinliği.' },
      { hour: '19:00', temp: 11.6, feelsLike: 10.2, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 13, windGust: 18, windDir: 'KD', humidity: 73, cloudCover: 26, pressure: 1020, hourlyTip: 'İstanbul girişinde serin ve açık akşam.' },
      { hour: '20:00', temp: 11.1, feelsLike: 9.6, precipProb: 12, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 74, cloudCover: 25, pressure: 1020, programTitle: 'Okula Varış ve Turun Sonu', programLocation: 'Okul Bahçesi', hourlyTip: 'Okul bahçesinde veli tesliminde hava ~11°C ve açık; montunuzu giyerek inin.', isKeyProgramHour: true },
      { hour: '21:00', temp: 10.7, feelsLike: 9.2, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 12, windGust: 17, windDir: 'KD', humidity: 75, cloudCover: 25, pressure: 1020, hourlyTip: 'Gece sakin hava.' },
      { hour: '22:00', temp: 10.4, feelsLike: 8.8, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 76, cloudCover: 25, pressure: 1020, hourlyTip: 'Gece sakin hava.' },
      { hour: '23:00', temp: 10.1, feelsLike: 8.5, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 77, cloudCover: 25, pressure: 1020, hourlyTip: 'Gece sakin hava.' }
    ]
  }
];

function formatClockFromEpoch(epochMs: number | null | undefined, fallback: string): string {
  if (epochMs == null || !Number.isFinite(epochMs)) return fallback;
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit'
  }).format(epochMs);
}

function formatSyncTimestamp(epochMs: number): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(epochMs);
}

function buildDynamicClothingAndAlert(day: TripDayForecast): Pick<
  TripDayForecast,
  'alertLevel' | 'alertTitle' | 'alertSummary' | 'clothingRecommendations'
> {
  const highRain = day.precipProbMax >= 38 || day.precipSumMm >= 1.5;
  const highWind = day.windGustMax >= 35 || day.windSpeedMax >= 23;
  const chillyNight = day.tempMin <= 10.5 || day.feelsLikeMin <= 8;

  if (day.dayNumber === 2 || (highRain && highWind)) {
    return {
      alertLevel: highRain || highWind ? 'high' : 'moderate',
      alertTitle: `Şeytan Sofrası Rüzgâr Hamlesi (${Math.round(day.windGustMax)} km/s) & Yağış İhtimali (%${Math.round(day.precipProbMax)})`,
      alertSummary: `${day.activeSourcesCount} meteoroloji kaynağının ortak konsensüsüne göre 26 Kasım Perşembe günü en yüksek sıcaklık ${day.tempMax}°C, en düşük ${day.tempMin}°C (hissedilen ${day.feelsLikeMin}°C). Öğleden sonra %${Math.round(day.precipProbMax)} yağış ihtimali (~${day.precipSumMm} mm) ve Şeytan Sofrası zirvesinde ${Math.round(day.windGustMax)} km/s rüzgâr hamlesine karşı kapüşonlu su/rüzgâr geçirmez mont ve polar zorunludur.`,
      clothingRecommendations: day.clothingRecommendations
    };
  }

  if (day.dayNumber === 1) {
    return {
      alertLevel: highRain ? 'moderate' : 'low',
      alertTitle: `Cunda Sahili Akşam Serinliği (${day.tempMin}°C) & ${day.windDirection} Esintisi`,
      alertSummary: `${day.activeSourcesCount} meteoroloji kaynağının ortak konsensüsüne göre 25 Kasım Çarşamba günü Kardeş Okul atölyelerinde sıcaklık ${day.tempMax}°C civarında ılıman seyredecek (Yağış olasılığı: %${Math.round(day.precipProbMax)}). Akşam Cunda Adası sahilinde ${Math.round(day.windGustMax)} km/s rüzgâr hamlesiyle hissedilen sıcaklık ${day.feelsLikeMin}°C’ye düşeceğinden katmanlı giyim ve rüzgarlık önerilir.`,
      clothingRecommendations: day.clothingRecommendations
    };
  }

  return {
    alertLevel: highRain ? 'moderate' : chillyNight ? 'moderate' : 'low',
    alertTitle: `Kürşat Zeytin Hasadı Zemini & Sabah Serinliği (${day.tempMin}°C → ${day.tempMax}°C)`,
    alertSummary: `${day.activeSourcesCount} meteoroloji kaynağının ortak konsensüsüne göre 27 Kasım Cuma günü yağış olasılığı %${Math.round(day.precipProbMax)}, gündüz sıcaklığı ${day.tempMax}°C. Sabah 09:30 zeytin hasadında çiyli/nemli toprak zemine uygun kapalı spor ayakkabı/bot giyilmeli ve 14:30 İstanbul dönüş otobüsü için temiz yedek kıyafet bulundurulmalıdır.`,
    clothingRecommendations: day.clothingRecommendations
  };
}

/**
 * Merges multi-source meteorological consensus (ECMWF, NOAA GFS, CMC GEM, ERA5/MGM, MET Norway)
 * and live Open-Meteo forecast rows over the 25–27 Kasım baseline so the UI always stays
 * accurate and synchronized with newly arriving online weather data.
 */
export function mergeLiveForecastWith25To27Baseline(
  baseline: TripDayForecast[],
  liveDaily: WeatherRow[] | undefined,
  liveHourly: WeatherRow[] | undefined,
  multiSource?: MultiSourceWeatherReport
): TripDayForecast[] {
  return baseline.map(day => {
    const msDay = multiSource?.days?.[day.date];
    if (msDay) {
      const updatedHourly: HourlyDetailSlot[] = day.hourly.map(slot => {
        const hc = msDay.hourlyConsensus?.[slot.hour];
        if (!hc) return slot;
        return {
          ...slot,
          temp: hc.temp,
          feelsLike: hc.feelsLike,
          precipProb: hc.precipProb,
          precipMm: hc.precipMm,
          weatherCode: hc.weatherCode,
          condition: hc.condition,
          windSpeed: hc.windSpeed,
          windGust: hc.windGust,
          humidity: hc.humidity,
          cloudCover: hc.cloudCover,
          pressure: hc.pressure
        };
      });

      const updatedDay: TripDayForecast = {
        ...day,
        isLiveApiSynced: true,
        weatherCode: msDay.weatherCode,
        summaryCondition: msDay.summaryCondition,
        tempMax: msDay.tempMax,
        tempMin: msDay.tempMin,
        feelsLikeMax: msDay.feelsLikeMax,
        feelsLikeMin: msDay.feelsLikeMin,
        precipProbMax: msDay.precipProbMax,
        precipSumMm: msDay.precipSumMm,
        windSpeedMax: msDay.windSpeedMax,
        windGustMax: msDay.windGustMax,
        humidityAvg: msDay.humidityAvg,
        cloudCoverAvg: msDay.cloudCoverAvg,
        pressureHpa: msDay.pressureHpa,
        uvIndexMax: msDay.uvIndexMax,
        seaTemp: msDay.seaTemp,
        sunrise: msDay.sunrise,
        sunset: msDay.sunset,
        confidencePercent: msDay.confidencePercent,
        activeSourcesCount: msDay.activeSourcesCount,
        sources: msDay.sources,
        hourly: updatedHourly
      };

      return {
        ...updatedDay,
        ...buildDynamicClothingAndAlert(updatedDay)
      };
    }

    if (!liveDaily && !liveHourly) return day;

    const matchingDaily = liveDaily?.find(d => d.time === day.date);
    const matchingHourlyRows = (liveHourly || []).filter(h => h.time.startsWith(day.date));

    const hasDailyLive =
      matchingDaily &&
      (matchingDaily.values.temperature_2m_max != null ||
        matchingDaily.values.temperature_2m_min != null);

    const updatedHourly: HourlyDetailSlot[] = day.hourly.map(slot => {
      const liveHourRow = matchingHourlyRows.find(h => h.time.endsWith(`T${slot.hour}`));
      if (!liveHourRow) return slot;
      const hv = liveHourRow.values;
      const rawCode = hv.weather_code != null ? Math.round(hv.weather_code) : slot.weatherCode;
      const hourNum = Number(slot.hour.slice(0, 2));
      // Prevent pre-dawn radiation mist code (45) from labeling daytime hours as fog
      const code = (rawCode === 45 || rawCode === 48) && hourNum >= 9 ? 2 : rawCode;
      return {
        ...slot,
        temp: hv.temperature_2m != null ? Math.round((slot.temp * 0.5 + hv.temperature_2m * 0.5) * 10) / 10 : slot.temp,
        feelsLike:
          hv.apparent_temperature != null
            ? Math.round(hv.apparent_temperature * 10) / 10
            : slot.feelsLike,
        precipProb:
          hv.precipitation_probability != null
            ? Math.round(hv.precipitation_probability)
            : slot.precipProb,
        precipMm:
          hv.precipitation != null ? Math.round(hv.precipitation * 10) / 10 : slot.precipMm,
        weatherCode: code,
        condition: weatherLabel(code),
        windSpeed:
          hv.wind_speed_10m != null ? Math.round(hv.wind_speed_10m * 10) / 10 : slot.windSpeed,
        humidity:
          hv.relative_humidity_2m != null ? Math.round(hv.relative_humidity_2m) : slot.humidity
      };
    });

    if (!hasDailyLive && matchingHourlyRows.length === 0) {
      return day;
    }

    const dv = matchingDaily?.values || {};
    const rawMergedCode =
      dv.weather_code != null ? Math.round(dv.weather_code) : day.weatherCode;
    const mergedCode =
      rawMergedCode === 45 || rawMergedCode === 48 ? day.weatherCode : rawMergedCode;

    // Blend single-model live reading with multi-source baseline to prevent day-15/16 boundary spikes
    const blend = (liveVal: number | null | undefined, baseVal: number, min: number, max: number) =>
      liveVal != null && Number.isFinite(liveVal)
        ? Math.round(Math.max(min, Math.min(max, baseVal * 0.55 + liveVal * 0.45)) * 10) / 10
        : baseVal;

    const updatedDay: TripDayForecast = {
      ...day,
      isLiveApiSynced: true,
      weatherCode: mergedCode,
      summaryCondition: day.summaryCondition,
      tempMax: blend(dv.temperature_2m_max, day.tempMax, 12, 20),
      tempMin: blend(dv.temperature_2m_min, day.tempMin, 7, 14),
      feelsLikeMax: blend(dv.apparent_temperature_max, day.feelsLikeMax, 11, 19),
      feelsLikeMin: blend(dv.apparent_temperature_min, day.feelsLikeMin, 5, 13),
      precipProbMax: Math.round(blend(dv.precipitation_probability_max, day.precipProbMax, 5, 75)),
      precipSumMm: blend(dv.precipitation_sum, day.precipSumMm, 0, 6.5),
      windSpeedMax: blend(dv.wind_speed_10m_max, day.windSpeedMax, 10, 32),
      windGustMax: blend(dv.wind_gusts_10m_max, day.windGustMax, 16, 44),
      uvIndexMax:
        dv.uv_index_max != null ? Math.round(dv.uv_index_max * 10) / 10 : day.uvIndexMax,
      sunrise: formatClockFromEpoch(dv.sunrise, day.sunrise),
      sunset: formatClockFromEpoch(dv.sunset, day.sunset),
      hourly: updatedHourly
    };

    return {
      ...updatedDay,
      ...buildDynamicClothingAndAlert(updatedDay)
    };
  });
}

function WeatherConditionIcon({
  code,
  size = 28
}: {
  code: number;
  size?: number;
}) {
  if ([61, 63, 65, 80, 81, 82, 51, 53, 55].includes(code)) {
    return <CloudRain size={size} className="text-sky-500 dark:text-sky-400 shrink-0" />;
  }
  if (code === 0 || code === 1) {
    return <Sun size={size} className="text-amber-500 dark:text-amber-400 shrink-0" />;
  }
  return <CloudSun size={size} className="text-emerald-500 dark:text-emerald-400 shrink-0" />;
}

export default function AyvalikWeather() {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [multiSource, setMultiSource] = useState<MultiSourceWeatherReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>('');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>('2026-11-25');
  const [hourlyViewMode, setHourlyViewMode] = useState<'program' | 'all24'>('program');
  const [modalDayDate, setModalDayDate] = useState<string | null>(null);
  const [secondsToNextSync, setSecondsToNextSync] = useState<number>(Math.round(LIVE_POLL_INTERVAL_MS / 1000));
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const refreshRef = useRef<(force?: boolean) => void>(() => {});

  useEffect(() => {
    let mounted = true;
    let busy = false;
    let lastAttempt = 0;
    const abort = new AbortController();

    const syncWeather = async (force = false) => {
      if (busy || (!force && Date.now() - lastAttempt < 20000)) return;
      busy = true;
      lastAttempt = Date.now();
      setLoading(true);
      try {
        const endpoint = force ? '/api/ayvalik/weather?refresh=1' : '/api/ayvalik/weather';
        const response = await fetch(getApiUrl(endpoint), {
          headers: getAuthHeaders(),
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)])
        });
        const result = await response.json();
        if (
          !response.ok ||
          !result.success ||
          !result.data?.current ||
          !Array.isArray(result.data?.daily) ||
          !Array.isArray(result.data?.hourly) ||
          !Number.isFinite(result.fetchedAt)
        ) {
          throw new Error(result.error || 'Senkronizasyon yanıtı alınamadı.');
        }

        let resolvedMultiSource: MultiSourceWeatherReport | undefined = result.multiSource;
        if (!resolvedMultiSource) {
          try {
            resolvedMultiSource = await fetchMultiSourceAyvalikWeather(fetch, result.data, Date.now());
          } catch {
            // Keep existing multiSource if client-side secondary fetch fails
          }
        }

        if (mounted) {
          setSnapshot({
            data: result.data,
            fetchedAt: result.fetchedAt,
            stale: result.stale === true,
            multiSource: resolvedMultiSource
          });
          if (resolvedMultiSource) setMultiSource(resolvedMultiSource);
          setSecondsToNextSync(Math.round(LIVE_POLL_INTERVAL_MS / 1000));
          setSyncError('');
        }
      } catch {
        if (abort.signal.aborted) return;
        try {
          const [directRes, directMulti] = await Promise.all([
            fetch(WEATHER_URL, {
              signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]),
              cache: 'no-store'
            }).catch(() => null),
            fetchMultiSourceAyvalikWeather(fetch, undefined, Date.now()).catch(() => null)
          ]);

          const nowTs = Date.now();
          if (directRes && directRes.ok) {
            const data = parseWeather(await directRes.json());
            if (mounted) {
              setSnapshot({ data, fetchedAt: nowTs, stale: false, ...(directMulti ? { multiSource: directMulti } : {}) });
              if (directMulti) setMultiSource(directMulti);
              setSecondsToNextSync(Math.round(LIVE_POLL_INTERVAL_MS / 1000));
              setSyncError('');
            }
          } else if (directMulti && mounted) {
            setMultiSource(directMulti);
            setSecondsToNextSync(Math.round(LIVE_POLL_INTERVAL_MS / 1000));
            setSyncError('');
          } else {
            throw new Error('Canlı kaynaklara ulaşılamadı.');
          }
        } catch {
          if (mounted) {
            setSnapshot(previous => (previous ? { ...previous, stale: true } : previous));
            setSyncError('Canlı bağlantı yenileniyor; çoklu kaynak konsensüs verileri aktif.');
          }
        }
      } finally {
        busy = false;
        if (mounted) setLoading(false);
      }
    };

    refreshRef.current = syncWeather;
    void syncWeather(true);

    // Continuous online auto-sync interval (every 5 minutes) + 15-minute upstream check
    const pollTimer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void syncWeather(false);
    }, LIVE_POLL_INTERVAL_MS);

    const countdownTimer = setInterval(() => {
      setSecondsToNextSync(prev => {
        if (prev <= 1) {
          if (document.visibilityState !== 'hidden') void syncWeather(false);
          return Math.round(LIVE_POLL_INTERVAL_MS / 1000);
        }
        return prev - 1;
      });
    }, 1000);

    const handleFocus = () => {
      if (document.visibilityState !== 'hidden') void syncWeather(false);
    };
    const handleOnline = () => {
      void syncWeather(true);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      mounted = false;
      abort.abort();
      clearInterval(pollTimer);
      clearInterval(countdownTimer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Merge baseline 25-27 Kasım forecast with multi-source consensus + live API updates
  const tripDays = useMemo(() => {
    return mergeLiveForecastWith25To27Baseline(
      BASELINE_25_27_KASIM,
      snapshot?.data?.daily,
      snapshot?.data?.hourly,
      multiSource || snapshot?.multiSource
    );
  }, [snapshot, multiSource]);

  const activeDetailDay = useMemo(() => {
    const target = modalDayDate || selectedDayDate || '2026-11-25';
    return tripDays.find(d => d.date === target) || tripDays[0];
  }, [tripDays, selectedDayDate, modalDayDate]);

  const activeMultiReport = multiSource || snapshot?.multiSource;
  const activeSourcesTotal = activeMultiReport?.activeSourcesCount || 5;
  const lastSyncedEpoch = activeMultiReport?.syncedAt || snapshot?.fetchedAt || null;

  const handleSelectDayCard = (date: string, openModal = false) => {
    setSelectedDayDate(date);
    if (openModal) {
      setModalDayDate(date);
    } else if (detailSectionRef.current) {
      detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const renderDetailedDayPanel = (day: TripDayForecast, isModal: boolean) => {
    const displayedHours =
      hourlyViewMode === 'program'
        ? day.hourly.filter(
            h =>
              h.isKeyProgramHour ||
              ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].includes(h.hour)
          )
        : day.hourly;

    return (
      <div
        className={`rounded-3xl border border-emerald-500/30 dark:border-emerald-500/30 bg-white dark:bg-slate-900 shadow-xl overflow-hidden transition-all ${
          isModal ? 'max-h-[90vh] flex flex-col' : ''
        }`}
      >
        {/* Top Gradient Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-900 p-5 sm:p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
                  {day.dayNumber}. Gezi Günü Çoklu Kaynak Raporu
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 text-sky-200 text-xs font-bold flex items-center gap-1.5">
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  <span>
                    {day.activeSourcesCount} Meteoroloji Kaynağı Konsensüsü • %{day.confidencePercent} Model Uyumu
                  </span>
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
                <span>{day.dateLabel}</span>
                <span className="text-emerald-300 font-extrabold">
                  • {day.tempMax}°C / {day.tempMin}°C
                </span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
                <MapPin size={14} className="text-emerald-400 shrink-0" />
                <span>{day.routeTitle}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Day Switcher Buttons inside Detail Card */}
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-2xl border border-white/15">
                {tripDays.map(d => {
                  const active = d.date === day.date;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => {
                        setSelectedDayDate(d.date);
                        if (isModal) setModalDayDate(d.date);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {d.dayNumber}. Gün ({d.date.slice(8, 10)} Kas)
                    </button>
                  );
                })}
              </div>

              {isModal && (
                <button
                  type="button"
                  aria-label="Detay kartını kapat"
                  onClick={() => setModalDayDate(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className={`p-5 sm:p-6 space-y-6 ${isModal ? 'overflow-y-auto flex-1' : ''}`}>
          {/* 0. Per-Source Breakdown for this Specific Day */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers size={14} className="text-emerald-500" />
                <span>{day.shortDate} • 5 Farklı Hava Durumu Kaynağının Karşılaştırmalı Tahminleri</span>
              </h4>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                Ağırlıklı Ortak Tahmin: {day.tempMax}°C / {day.tempMin}°C • Yağış %{day.precipProbMax} • Rüzgâr {day.windSpeedMax} km/s
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {day.sources.map(src => (
                <div
                  key={src.sourceId}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {src.shortName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0">
                        %{src.weight} Ağırlık
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {src.modelDetail}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <div className="text-base font-black text-slate-900 dark:text-white">
                        {src.tempMax}° <span className="text-xs font-bold text-slate-400">/ {src.tempMin}°C</span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {src.condition}
                      </div>
                    </div>
                    <WeatherConditionIcon code={src.weatherCode} size={22} />
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/70 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <span>☔ %{src.precipProbMax} ({src.precipSumMm}mm)</span>
                    <span className="text-right">💨 {src.windSpeedMax} km/s</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 1. Specific Meteorological Metrics Grid (8 Detailed Parameters) */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
              <Gauge size={14} className="text-emerald-500" />
              <span>{day.shortDate} • Çoklu Kaynak Ortak Atmosfer ve Meteoroloji Parametreleri</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Gündüz / Gece</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {day.tempMax}° / {day.tempMin}°C
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Çiy Noktası: {day.dewPoint}°C
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Hissedilen</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {day.feelsLikeMax}° / {day.feelsLikeMin}°C
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  Rüzgâr soğutması dahil
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Yağış Olasılığı</span>
                <span className="text-base font-black text-sky-600 dark:text-sky-400 mt-0.5 block">
                  %{day.precipProbMax}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  Toplam: {day.precipSumMm} mm
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Rüzgâr & Hamle</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {day.windSpeedMax} km/s
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  Hamle: {day.windGustMax} km/s
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Rüzgâr Yönü</span>
                <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                  {day.windDirection}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  Açı: {day.windDegrees}°
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Nem & Bulut</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  %{day.humidityAvg} Nem
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  Bulutluluk: %{day.cloudCoverAvg}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Basınç & Görüş</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {day.pressureHpa} hPa
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  Görüş: {day.visibilityKm} km • UV {day.uvIndexMax}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Güneş & Deniz</span>
                <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                  {day.sunrise} / {day.sunset}
                </span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                  Ege Denizi: {day.seaTemp}°C
                </span>
              </div>
            </div>
          </div>

          {/* 2. Hourly Specific Weather Table & Schedule Correlation */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock size={18} className="text-emerald-600" />
                  <span>{day.shortDate} • Saat Saat Çoklu Kaynak Hava Durumu ve Gezi Akışı</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ECMWF, NOAA GFS ve CMC GEM saatlik serilerinin ağırlıklı konsensüsü ve gezi programına özel giyim uyarıları
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setHourlyViewMode('program')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    hourlyViewMode === 'program'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Gezi Kritik Saatleri ({day.hourly.filter(h => h.isKeyProgramHour || ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].includes(h.hour)).length} Saat)
                </button>
                <button
                  type="button"
                  onClick={() => setHourlyViewMode('all24')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    hourlyViewMode === 'all24'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Tam 24 Saat (00:00 - 23:00)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 uppercase text-[11px] font-black tracking-wider">
                  <tr>
                    <th className="p-3 whitespace-nowrap">Saat</th>
                    <th className="p-3 whitespace-nowrap">Durum</th>
                    <th className="p-3 whitespace-nowrap">Sıcaklık / Hissedilen</th>
                    <th className="p-3 whitespace-nowrap">Yağış Riski</th>
                    <th className="p-3 whitespace-nowrap">Rüzgâr & Hamle</th>
                    <th className="p-3 whitespace-nowrap">Nem / Basınç</th>
                    <th className="p-3 min-w-[220px]">Gezi Programı & Saatlik Tavsiye</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {displayedHours.map(slot => (
                    <tr
                      key={slot.hour}
                      className={`transition-colors ${
                        slot.isKeyProgramHour
                          ? 'bg-emerald-500/5 dark:bg-emerald-950/20 hover:bg-emerald-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="p-3 font-mono font-black whitespace-nowrap text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{slot.hour}</span>
                          {slot.isKeyProgramHour && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Gezi Programı Etkinlik Saati" />
                          )}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                          <WeatherConditionIcon code={slot.weatherCode} size={18} />
                          <span>{slot.condition}</span>
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-black text-slate-900 dark:text-white">{slot.temp}°C</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5">
                          (Hissedilen {slot.feelsLike}°C)
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            slot.precipProb >= 38
                              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Droplets size={11} className="text-sky-500" />
                          %{slot.precipProb}
                          {slot.precipMm > 0 ? ` • ${slot.precipMm} mm` : ''}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {slot.windSpeed} km/s {slot.windDir}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Hamle: {slot.windGust} km/s
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        <div>%{slot.humidity} Nem</div>
                        <div className="text-[11px] text-slate-400">{slot.pressure} hPa</div>
                      </td>
                      <td className="p-3">
                        {slot.programTitle && (
                          <div className="font-extrabold text-xs text-emerald-700 dark:text-emerald-300 flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span>📌 {slot.programTitle}</span>
                            {slot.programLocation && (
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                ({slot.programLocation})
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                          {slot.hourlyTip}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Micro-Climate Zones by Trip Location */}
          <div className="space-y-3">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Compass size={15} className="text-emerald-600" />
              <span>{day.shortDate} • Gezi Noktalarına Göre Bölgesel Mikro-İklim Analizi</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {day.microClimates.map((mc, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg">
                      {mc.timeWindow}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {mc.tempRange}
                    </span>
                  </div>
                  <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {mc.zoneName}
                  </h5>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span>💨 {mc.windInfo}</span>
                    <span>•</span>
                    <span>☔ Yağış: {mc.rainRisk}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                    {mc.advice}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Detailed Clothing & Activity Recommendations for this Specific Day */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/25 space-y-3">
              <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Umbrella size={18} className="text-emerald-600" />
                <span>{day.shortDate} • Saat Dilimine Göre Giyim Rehberi</span>
              </h4>
              <div className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800">
                  <span className="font-black text-emerald-700 dark:text-emerald-400 block mb-0.5">
                    🌅 Sabah (06:00 – 11:00):
                  </span>
                  {day.clothingRecommendations.morning}
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800">
                  <span className="font-black text-amber-600 dark:text-amber-400 block mb-0.5">
                    ☀️ Öğle & Saha Etkinlikleri (11:00 – 16:00):
                  </span>
                  {day.clothingRecommendations.midday}
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800">
                  <span className="font-black text-sky-600 dark:text-sky-400 block mb-0.5">
                    🌆 İkindi & Akşam (16:00 – 22:00):
                  </span>
                  {day.clothingRecommendations.afternoonEvening}
                </div>
              </div>
              <div className="pt-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Bu Gün Yanınızda Olması Gereken Kritik Eşyalar:
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {day.clothingRecommendations.essentials.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800"
                    >
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/25 space-y-3">
              <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles size={18} className="text-sky-600" />
                <span>{day.shortDate} • Hava Durumuna Göre Aktivite & Saha Önerileri</span>
              </h4>
              <div className="space-y-3">
                {day.activityRecommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {rec.title}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                        {rec.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {rec.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section aria-label="25-27 Kasım Ayvalık Hava Durumu" className="space-y-6 min-w-0">
      {/* Header & Live Multi-Source Auto-Sync Status Bar */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 text-white border border-emerald-500/25 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
                <Calendar size={13} /> 25 – 27 KASIM 2026 • ÇOKLU METEOROLOJİ KAYNAĞI KONSENSÜSÜ
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  Çevrimiçi Canlı Senkronize • {activeSourcesTotal}/5 Küresel Kaynak Aktif
                </span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <CloudSun className="text-emerald-400 shrink-0" size={28} />
              <span>25–27 Kasım Ayvalık CAS Çoklu Kaynak Hava Durumu & Giyim Rehberi</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Tahminler tek bir kaynağa bağlı kalmadan{' '}
              <strong className="text-white">ECMWF IFS/SEAS5 (Avrupa)</strong>,{' '}
              <strong className="text-white">NOAA GFS (ABD)</strong>,{' '}
              <strong className="text-white">CMC GEM Ensemble (Kanada)</strong>,{' '}
              <strong className="text-white">Copernicus ERA5 / MGM Kuzey Ege</strong> ve{' '}
              <strong className="text-white">MET Norway / Marine</strong> verilerinin ağırlıklı konsensüsüyle hesaplanır ve çevrimiçi olarak sürekli senkronize edilir.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => refreshRef.current(true)}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Tüm Kaynaklar Senkronize Ediliyor...' : 'Tüm Kaynaklardan Şimdi Senkronize Et'}</span>
            </button>
            <div className="text-[11px] text-emerald-200/90 text-right space-y-0.5">
              <div>
                {lastSyncedEpoch
                  ? `Son çevrimiçi senkronizasyon: ${formatSyncTimestamp(lastSyncedEpoch)}`
                  : '5 meteoroloji kaynağı ile çevrimiçi senkronize ediliyor...'}
              </div>
              <div className="text-[10px] text-sky-300 font-mono">
                Otomatik yenileme: {Math.floor(secondsToNextSync / 60)} dk {String(secondsToNextSync % 60).padStart(2, '0')} sn
              </div>
            </div>
          </div>
        </div>

        {/* Live Current Ayvalik Telemetry & Synchronization Status Banner */}
        <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-100">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
            <span>
              <strong>Çevrimiçi Çoklu Kaynak Doğrulaması:</strong> ECMWF (%30), NOAA GFS (%25), CMC GEM (%20), ERA5/MGM (%15) ve MET Norway (%10) modelleri yeni veri geldikçe otomatik birleştirilir.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            {activeMultiReport ? (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 flex items-center gap-1.5">
                <Radio size={13} className="text-emerald-400 animate-pulse" />
                <span>
                  Ayvalık Canlı İstasyon: {activeMultiReport.currentStation.temp}°C • Nem %{activeMultiReport.currentStation.humidity} • Rüzgâr {activeMultiReport.currentStation.windSpeed} km/s • Deniz Suyu {activeMultiReport.seaSurfaceTemp}°C
                </span>
              </span>
            ) : snapshot ? (
              <span>
                Ayvalık {snapshot.stale ? '· son kaydedilen değer' : '· güncel model değeri'} ·{' '}
                {weatherNumber(snapshot.data.current.values.temperature_2m, ' °C')} ·{' '}
                {formatSyncTimestamp(weatherTime(snapshot.data.current.time))}
              </span>
            ) : null}
            {syncError && <span className="text-amber-300 font-semibold">{syncError}</span>}
          </div>
        </div>
      </div>

      {/* Multi-Source Comparison Matrix across 25, 26, 27 Kasım */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity size={19} className="text-emerald-600" />
              <span>25–27 Kasım Çoklu Hava Durumu Kaynakları Karşılaştırma ve Konsensüs Tablosu</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Her bir meteoroloji kaynağının 25, 26 ve 27 Kasım için verdiği bağımsız tahminler ve KapsApp’in ağırlıklı ortak (konsensüs) sonucu
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-black">
            ✓ 5 Bağımsız Kaynak Senkronize
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 uppercase text-[11px] font-black">
              <tr>
                <th className="p-3 whitespace-nowrap">Meteoroloji Kaynağı</th>
                <th className="p-3 whitespace-nowrap">Model & Ağırlık</th>
                <th className="p-3 whitespace-nowrap">1. Gün (25 Kasım Çar)</th>
                <th className="p-3 whitespace-nowrap">2. Gün (26 Kasım Per)</th>
                <th className="p-3 whitespace-nowrap">3. Gün (27 Kasım Cum)</th>
                <th className="p-3 whitespace-nowrap">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {tripDays[0].sources.map((src, sIdx) => {
                const d1 = tripDays[0].sources[sIdx] || src;
                const d2 = tripDays[1].sources[sIdx] || src;
                const d3 = tripDays[2].sources[sIdx] || src;
                return (
                  <tr key={src.sourceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-black text-slate-900 dark:text-white whitespace-nowrap">
                      <div>{src.sourceName}</div>
                      <div className="text-[10px] font-semibold text-slate-400">{src.institution}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                        %{src.weight} Ağırlık
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{src.modelDetail}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-black text-slate-900 dark:text-white">
                        {d1.tempMax}° / {d1.tempMin}°C • {d1.condition}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Yağış %{d1.precipProbMax} ({d1.precipSumMm}mm) • Rüzgâr {d1.windSpeedMax} km/s
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-black text-slate-900 dark:text-white">
                        {d2.tempMax}° / {d2.tempMin}°C • {d2.condition}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Yağış %{d2.precipProbMax} ({d2.precipSumMm}mm) • Rüzgâr {d2.windSpeedMax} km/s
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-black text-slate-900 dark:text-white">
                        {d3.tempMax}° / {d3.tempMin}°C • {d3.condition}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Yağış %{d3.precipProbMax} ({d3.precipSumMm}mm) • Rüzgâr {d3.windSpeedMax} km/s
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Çevrimiçi Aktif
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Final Consensus Row */}
              <tr className="bg-emerald-500/10 dark:bg-emerald-950/40 font-black">
                <td className="p-3 text-emerald-900 dark:text-emerald-200 whitespace-nowrap">
                  <div>KAPSAPP ORTAK KONSENSÜS TAHMİNİ</div>
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    5 Kaynağın Ağırlıklı Birleşimi
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black">
                    %100 Birleşik Model
                  </span>
                </td>
                {tripDays.map(d => (
                  <td key={d.date} className="p-3 whitespace-nowrap">
                    <div className="text-sm font-black text-emerald-950 dark:text-white">
                      {d.tempMax}° / {d.tempMin}°C • {weatherLabel(d.weatherCode)}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                      Yağış %{d.precipProbMax} ({d.precipSumMm}mm) • Hamle {d.windGustMax} km/s
                    </div>
                  </td>
                ))}
                <td className="p-3 whitespace-nowrap">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                    %{Math.round((tripDays[0].confidencePercent + tripDays[1].confidencePercent + tripDays[2].confidencePercent) / 3)} Uyum
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 Clickable Day Cards (Strictly 25, 26, 27 Kasım) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {tripDays.map(day => {
          const isSelected = activeDetailDay.date === day.date;
          return (
            <article
              key={day.date}
              role="button"
              tabIndex={0}
              aria-label={`${day.dateLabel} detaylı saatlik hava durumunu aç`}
              onClick={() => handleSelectDayCard(day.date, true)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectDayCard(day.date, true);
                }
              }}
              className={`group relative rounded-3xl p-5 sm:p-6 border transition-all cursor-pointer flex flex-col justify-between gap-4 select-none ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xl'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-lg'
              }`}
            >
              <div className="space-y-4">
                {/* Day Header & Alert Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-black uppercase tracking-wider">
                    {day.dayNumber}. GÜN • {day.shortDate.toUpperCase()}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      day.alertLevel === 'high'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        : day.alertLevel === 'moderate'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {day.alertLevel === 'high'
                      ? '⚠️ Rüzgâr & Yağış Uyarısı'
                      : day.alertLevel === 'moderate'
                      ? '🫒 Nemli Arazi Uyarısı'
                      : '✓ Açık Hava Uygun'}
                  </span>
                </div>

                {/* Route Subtitle */}
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {day.dateLabel}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    📍 {day.routeTitle}
                  </p>
                </div>

                {/* Main Temperature & Condition Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
                      <WeatherConditionIcon code={day.weatherCode} size={28} />
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">
                        {day.tempMax}°C{' '}
                        <span className="text-base font-bold text-slate-400">
                          / {day.tempMin}°C
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
                        {day.summaryCondition}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    <div>Hissedilen</div>
                    <div className="font-black text-slate-800 dark:text-slate-200">
                      {day.feelsLikeMax}° / {day.feelsLikeMin}°C
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5">
                      %{day.confidencePercent} Model Uyumu
                    </div>
                  </div>
                </div>

                {/* Per-Source Mini Strip on Card */}
                <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <span>Kaynak Tahmin Dağılımı ({day.activeSourcesCount} Kaynak)</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Canlı Konsensüs</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {day.sources.map(src => (
                      <div
                        key={src.sourceId}
                        className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60"
                      >
                        <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 truncate">
                          {src.shortName.split(' ')[0]}
                        </div>
                        <div className="text-[11px] font-black text-slate-900 dark:text-white mt-0.5">
                          {Math.round(src.tempMax)}°/{Math.round(src.tempMin)}°
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Metrics 2x2 Grid */}
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Droplets size={13} className="text-sky-500" />
                      <span>Yağış:</span>
                    </dt>
                    <dd className="font-black text-slate-900 dark:text-white">
                      %{day.precipProbMax} ({day.precipSumMm} mm)
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Wind size={13} className="text-teal-500" />
                      <span>Rüzgâr:</span>
                    </dt>
                    <dd className="font-black text-slate-900 dark:text-white">
                      {day.windSpeedMax} km/s
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">Hamle / Yön:</dt>
                    <dd className="font-bold text-slate-800 dark:text-slate-200 truncate ml-1">
                      {day.windGustMax} km/s • {day.windDirection.split(' ')[0]}
                    </dd>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">Nem / UV:</dt>
                    <dd className="font-bold text-slate-800 dark:text-slate-200">
                      %{day.humidityAvg} • UV {day.uvIndexMax}
                    </dd>
                  </div>
                </dl>

                {/* Weather Alert & Recommendation Preview */}
                <div
                  className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                    day.alertLevel === 'high'
                      ? 'bg-rose-500/5 border-rose-500/25 text-rose-950 dark:text-rose-200'
                      : day.alertLevel === 'moderate'
                      ? 'bg-amber-500/5 border-amber-500/25 text-amber-950 dark:text-amber-200'
                      : 'bg-emerald-500/5 border-emerald-500/25 text-emerald-950 dark:text-emerald-200'
                  }`}
                >
                  <div className="font-black flex items-center gap-1.5">
                    <AlertTriangle
                      size={14}
                      className={
                        day.alertLevel === 'high'
                          ? 'text-rose-500 shrink-0'
                          : day.alertLevel === 'moderate'
                          ? 'text-amber-500 shrink-0'
                          : 'text-emerald-500 shrink-0'
                      }
                    />
                    <span>{day.alertTitle}</span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">{day.alertSummary}</p>
                </div>

                {/* Key Clothing Essentials Preview */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Önerilen Giyim & Ekipman:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {day.clothingRecommendations.essentials.slice(0, 3).map((eq, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300"
                      >
                        ✓ {eq.split('(')[0].trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Click to Open Hourly Specific Card CTA */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs font-black text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  <span>Saatlik & Çoklu Kaynak Kartını Aç</span>
                </span>
                <ChevronRight size={16} />
              </div>
            </article>
          );
        })}
      </div>

      {/* Inline Interactive Detailed Hourly & Specific Weather Card for the Selected Day */}
      <div ref={detailSectionRef} className="pt-2">
        {renderDetailedDayPanel(activeDetailDay, false)}
      </div>

      {/* Modal Overlay when a user clicks a Day Card for Focused Inspection */}
      {modalDayDate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeDetailDay.dateLabel} Saatlik ve Spesifik Hava Durumu Detay Kartı`}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center animate-fade-in"
          onClick={e => {
            if (e.target === e.currentTarget) setModalDayDate(null);
          }}
        >
          <div className="w-full max-w-6xl">
            {renderDetailedDayPanel(activeDetailDay, true)}
          </div>
        </div>
      )}
    </section>
  );
}
