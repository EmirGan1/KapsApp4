import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudRain,
  Sun,
  CloudSun,
  Wind,
  Droplets,
  Thermometer,
  Umbrella,
  RefreshCw,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Gauge,
  Sunrise,
  Sunset,
  Sparkles,
  ChevronRight,
  X,
  Compass,
  ShieldCheck,
  Calendar,
  Layers
} from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../../utils/api';
import {
  TRIP_DATES,
  WEATHER_REFRESH_MS,
  weatherLabel,
  weatherTime,
  weatherNumber,
  parseWeather,
  WEATHER_URL,
  type WeatherRow,
  type WeatherSnapshot
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

const BASELINE_25_27_KASIM: TripDayForecast[] = [
  {
    date: '2026-11-25',
    dayNumber: 1,
    dateLabel: '25 Kasım 2026, Çarşamba',
    shortDate: '25 Kasım Çarşamba',
    weekday: 'Çarşamba',
    routeTitle: 'İstanbul Çıkış • Kardeş Okul Saha Çalışması • Cunda Adası',
    summaryCondition: 'Parçalı Bulutlu & Akşam Kuzey Ege Esintili',
    weatherCode: 2,
    tempMax: 17,
    tempMin: 10,
    feelsLikeMax: 16,
    feelsLikeMin: 8,
    precipProbMax: 20,
    precipSumMm: 0.2,
    windSpeedMax: 21,
    windGustMax: 31,
    windDirection: 'Poyraz (KD)',
    windDegrees: 45,
    humidityAvg: 68,
    uvIndexMax: 3,
    pressureHpa: 1018,
    visibilityKm: 10,
    cloudCoverAvg: 45,
    dewPoint: 9,
    seaTemp: 17.4,
    sunrise: '08:04',
    sunset: '17:44',
    isLiveApiSynced: false,
    alertLevel: 'low',
    alertTitle: 'Cunda Sahili Akşam Serinliği & Poyraz Esintisi',
    alertSummary:
      'Gündüz kardeş okul atölyelerinde hava 16–17°C ile ılıman ve açık hava etkinliklerine çok uygun. Ancak 16:30 sonrası Cunda Adası sahilinde nem ve Poyraz esintisiyle hissedilen sıcaklık 9–10°C seviyesine düşecektir.',
    clothingRecommendations: {
      morning: '06:00 İstanbul kalkışında sabah ayazına karşı otobüste rahat eşofman/pantolon, tişört üzerine fermuarlı polar veya sweatshirt.',
      midday: '11:30–16:00 Kardeş Okul spor, sanat ve drama atölyelerinde hareketli olunacağı için nefes alan tişört + hafif sweatshirt ve rahat spor ayakkabı.',
      afternoonEvening: '17:00–20:30 Cunda Adası gezisi ve akşam yemeğinde deniz kenarı rüzgârını kesen rüzgarlık/mont şal veya bere.',
      essentials: [
        'Rahat yürüyüş / spor ayakkabısı (Kardeş okul saha etkinlikleri ve Cunda taş sokakları için)',
        'Fermuarlı polar veya kapüşonlu sweatshirt (Katmanlı giyim için)',
        'Rüzgâr kesici hafif mont (Cunda sahil yürüyüşü için)',
        'Yedek tişört ve çorap (Atölye çalışmaları sonrası değişim için)'
      ]
    },
    activityRecommendations: [
      {
        title: 'Kardeş Okul Açık Saha & Spor Atölyeleri (12:30 - 16:00)',
        detail: 'Öğle saatlerinde yağış beklentisi düşük (%15-20) ve sıcaklık 17°C civarında. Bahçe içi spor ve sanat atölyeleri kesintisiz uygulanabilir.',
        badge: 'Açık Hava Uygun'
      },
      {
        title: 'Cunda Adası Kültür Yürüyüşü (17:00 - 19:30)',
        detail: 'Gün batımı (17:44) sonrası kıyı şeridinde Poyraz 25-30 km/s hamle yapabilir. Fotoğraf çekimi ve sahil yürüyüşünde montunuzu yanınıza alın.',
        badge: 'Akşam Rüzgârı'
      },
      {
        title: 'Gece CAS Reflection Toplantısı (21:00)',
        detail: 'Otel içi toplantı salonunda gerçekleştirileceği için rahat kıyafetler tercih edilebilir.',
        badge: 'İç Mekân'
      }
    ],
    microClimates: [
      {
        zoneName: 'Otoyol & Balıkesir Geçişi',
        timeWindow: '06:00 – 11:00',
        tempRange: '9°C → 14°C',
        windInfo: '12 km/s KD',
        rainRisk: '%10 (Yerel Sabah Sisi)',
        advice: 'Susurluk-Balıkesir hattında sabah erken saatlerde yer yer pus görülebilir; mola tesislerinde dışarısı serin olacaktır.'
      },
      {
        zoneName: 'Ayvalık Merkez & Kardeş Okul Kampüsü',
        timeWindow: '11:30 – 16:30',
        tempRange: '15°C → 17°C',
        windInfo: '18 km/s Poyraz',
        rainRisk: '%20',
        advice: 'Günün en ılıman dilimi. Fiziksel aktivite sırasında terlememek için kolay çıkarılabilir üst katman giyin.'
      },
      {
        zoneName: 'Cunda (Alibey) Adası Kıyı Şeridi',
        timeWindow: '17:00 – 21:00',
        tempRange: '13°C → 10°C (Hissedilen 8°C)',
        windInfo: '24 km/s (Hamle 31 km/s)',
        rainRisk: '%20',
        advice: 'Deniz üzerinden gelen nemli rüzgâr soğukluk hissini artırır; dış mekân geçişlerinde mont şarttır.'
      }
    ],
    hourly: [
      { hour: '00:00', temp: 11, feelsLike: 10, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 74, cloudCover: 25, pressure: 1019, hourlyTip: 'Gece serin ve sakin hava.' },
      { hour: '01:00', temp: 11, feelsLike: 9, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 75, cloudCover: 25, pressure: 1019, hourlyTip: 'Gece serin hava.' },
      { hour: '02:00', temp: 10, feelsLike: 9, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 10, windGust: 15, windDir: 'KD', humidity: 76, cloudCover: 30, pressure: 1019, hourlyTip: 'Gece en düşük sıcaklık saatleri.' },
      { hour: '03:00', temp: 10, feelsLike: 8, precipProb: 10, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 10, windGust: 15, windDir: 'KD', humidity: 77, cloudCover: 35, pressure: 1018, hourlyTip: 'Sabaha karşı çiy oluşumu.' },
      { hour: '04:00', temp: 10, feelsLike: 8, precipProb: 10, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 78, cloudCover: 35, pressure: 1018, hourlyTip: 'Sabah öncesi serinlik.' },
      { hour: '05:00', temp: 10, feelsLike: 8, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 78, cloudCover: 40, pressure: 1018, hourlyTip: 'Evden çıkış hazırlığı: sabah ayazına uygun katmanlı giyinin.' },
      { hour: '06:00', temp: 10, feelsLike: 8, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 13, windGust: 19, windDir: 'KD', humidity: 77, cloudCover: 40, pressure: 1018, programTitle: 'Okuldan Hareket', programLocation: 'Okul Bahçesi', hourlyTip: 'Okul bahçesinde toplanma saatinde hava 10°C; otobüse binerken polarınızı yanınıza alın.', isKeyProgramHour: true },
      { hour: '07:00', temp: 11, feelsLike: 9, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 75, cloudCover: 42, pressure: 1018, programTitle: 'Otobüs Yolculuğu & Kahvaltı Paketi', programLocation: 'Otoyol Güzergahı', hourlyTip: 'Araç içi sıcaklık dengeli; mola yerlerinde dışarısı serin.' },
      { hour: '08:00', temp: 12, feelsLike: 11, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 15, windGust: 21, windDir: 'KD', humidity: 72, cloudCover: 45, pressure: 1018, hourlyTip: 'Gün doğumu (08:04) ile birlikte sıcaklık yükselmeye başlıyor.' },
      { hour: '09:00', temp: 13, feelsLike: 12, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 16, windGust: 22, windDir: 'KD', humidity: 69, cloudCover: 45, pressure: 1018, programTitle: 'Yol Dinlenme Molası', programLocation: 'Balıkesir Aksı', hourlyTip: 'Mola tesisinde açık havada hafif rüzgâr var.', isKeyProgramHour: true },
      { hour: '10:00', temp: 15, feelsLike: 14, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 17, windGust: 24, windDir: 'KD', humidity: 65, cloudCover: 45, pressure: 1018, hourlyTip: 'Ege kıyılarına yaklaşırken hava ısınıyor.' },
      { hour: '11:00', temp: 16, feelsLike: 15, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 18, windGust: 25, windDir: 'KD', humidity: 62, cloudCover: 48, pressure: 1018, programTitle: 'Ayvalık Varış & Kardeş Okul Karşılama', programLocation: 'Ayvalık Merkez', hourlyTip: 'Ayvalık merkezde 16°C ılıman hava; kalın montu otobüste bırakabilirsiniz.', isKeyProgramHour: true },
      { hour: '12:00', temp: 17, feelsLike: 16, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 19, windGust: 26, windDir: 'KD', humidity: 60, cloudCover: 48, pressure: 1017, programTitle: 'Kardeş Okul Tanışma & Saha Hazırlığı', programLocation: 'Kardeş Okul Kampüsü', hourlyTip: 'Günün en sıcak saatleri başlıyor, güneş gözlüğü kullanılabilir.', isKeyProgramHour: true },
      { hour: '13:00', temp: 17, feelsLike: 16, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 20, windGust: 28, windDir: 'KD', humidity: 59, cloudCover: 50, pressure: 1017, programTitle: 'Kardeş Okul Ortak Atölyeler (1. Oturum)', programLocation: 'Kardeş Okul Bahçesi', hourlyTip: 'Bahçe etkinlikleri için ideal sıcaklık, su mataranızı yanınızda bulundurun.', isKeyProgramHour: true },
      { hour: '14:00', temp: 17, feelsLike: 16, precipProb: 20, precipMm: 0.1, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 21, windGust: 29, windDir: 'KD', humidity: 61, cloudCover: 50, pressure: 1017, programTitle: 'Spor, Sanat ve Drama Atölyeleri', programLocation: 'Kardeş Okul Kampüsü', hourlyTip: 'Aktif saha çalışmasında sweatshirt yeterli olacaktır.' },
      { hour: '15:00', temp: 16, feelsLike: 15, precipProb: 20, precipMm: 0.1, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 21, windGust: 30, windDir: 'KD', humidity: 63, cloudCover: 48, pressure: 1017, programTitle: 'Atölye Sunumları & Kapanış', programLocation: 'Kardeş Okul Kampüsü', hourlyTip: 'Öğleden sonra rüzgâr hafifçe hızlanıyor (21 km/s).', isKeyProgramHour: true },
      { hour: '16:00', temp: 15, feelsLike: 13, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 20, windGust: 31, windDir: 'KD', humidity: 66, cloudCover: 45, pressure: 1018, programTitle: 'Otele Giriş (Check-in) & Cunda Hareket', programLocation: '4* Bacacan Otel', hourlyTip: 'Cunda çıkışı öncesi mutlaka rüzgarlık/montunuzu üzerinize alın.', isKeyProgramHour: true },
      { hour: '17:00', temp: 14, feelsLike: 12, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 20, windGust: 30, windDir: 'KD', humidity: 69, cloudCover: 45, pressure: 1018, programTitle: 'Cunda (Alibey) Adası Kültür Gezisi', programLocation: 'Cunda Adası', hourlyTip: 'Gün batımı (17:44) sırasında Cunda sahilinde rüzgâr serinletici.', isKeyProgramHour: true },
      { hour: '18:00', temp: 13, feelsLike: 10, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 19, windGust: 28, windDir: 'KD', humidity: 72, cloudCover: 42, pressure: 1018, programTitle: 'Cunda Taş Kahve & Sahil Yürüyüşü', programLocation: 'Cunda Sahili', hourlyTip: 'Hava karardıktan sonra hissedilen sıcaklık 10°C.' },
      { hour: '19:00', temp: 12, feelsLike: 10, precipProb: 15, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 18, windGust: 26, windDir: 'KD', humidity: 74, cloudCover: 38, pressure: 1019, programTitle: 'Akşam Yemeği', programLocation: 'Ayvalık / Otel Restoranı', hourlyTip: 'Akşam yemeği dönüşü dış mekânda mont giyilmeli.', isKeyProgramHour: true },
      { hour: '20:00', temp: 12, feelsLike: 9, precipProb: 15, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 17, windGust: 25, windDir: 'KD', humidity: 75, cloudCover: 35, pressure: 1019, hourlyTip: 'Otele geçiş ve dinlenme saati.' },
      { hour: '21:00', temp: 11, feelsLike: 9, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 16, windGust: 23, windDir: 'KD', humidity: 76, cloudCover: 35, pressure: 1019, programTitle: '1. Gün CAS Team Reflection Toplantısı', programLocation: 'Bacacan Otel Toplantı Salonu', hourlyTip: 'Otel içi toplantı; ertesi günkü Şeytan Sofrası rüzgârına karşı kıyafetlerinizi akşamdan hazırlayın.', isKeyProgramHour: true },
      { hour: '22:00', temp: 11, feelsLike: 9, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 15, windGust: 22, windDir: 'KD', humidity: 77, cloudCover: 35, pressure: 1019, hourlyTip: 'Gece istirahati.' },
      { hour: '23:00', temp: 10, feelsLike: 8, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 15, windGust: 21, windDir: 'KD', humidity: 78, cloudCover: 40, pressure: 1019, hourlyTip: 'Gece serin hava.' }
    ]
  },
  {
    date: '2026-11-26',
    dayNumber: 2,
    dateLabel: '26 Kasım 2026, Perşembe',
    shortDate: '26 Kasım Perşembe',
    weekday: 'Perşembe',
    routeTitle: 'Sabancı Üni. Küçükköy Yaratıcı Teknolojiler • Şeytan Sofrası Zirvesi',
    summaryCondition: 'Çok Bulutlu, Öğleden Sonra Kısa Sağanak Geçişli & Zirvede Kuvvetli Rüzgâr',
    weatherCode: 61,
    tempMax: 15,
    tempMin: 9,
    feelsLikeMax: 13,
    feelsLikeMin: 6,
    precipProbMax: 45,
    precipSumMm: 2.4,
    windSpeedMax: 28,
    windGustMax: 42,
    windDirection: 'Poyraz / Yıldız (KKD)',
    windDegrees: 25,
    humidityAvg: 76,
    uvIndexMax: 2,
    pressureHpa: 1014,
    visibilityKm: 8,
    cloudCoverAvg: 78,
    dewPoint: 10,
    seaTemp: 17.2,
    sunrise: '08:05',
    sunset: '17:43',
    isLiveApiSynced: false,
    alertLevel: 'high',
    alertTitle: 'Şeytan Sofrası Zirvesinde Sert Rüzgâr (42 km/s) ve Kısa Süreli Yağış Riski (%45)',
    alertSummary:
      'Gezinin meteorolojik olarak en dikkat edilmesi gereken günü! 13:30–16:30 arasında kısa süreli sonbahar sağanağı (%45 ihtimal) geçişi ve saat 15:30’da çıkılacak yüksek rakımlı Şeytan Sofrası tepesinde 40+ km/s rüzgâr hamlesiyle hissedilen sıcaklığın 6–7°C’ye düşmesi beklenmektedir.',
    clothingRecommendations: {
      morning: '08:00 Otel kahvaltısı ve Ayvalık sokakları kültür gezisi için su kaydırıcı mont/yağmurluk, içine sweatshirt ve rahat yürüyüş ayakkabısı.',
      midday: '11:00–14:30 Sabancı Üniversitesi Küçükköy Yaratıcı Teknolojiler Atölyesi ve sanat köylerinde iç-dış mekân geçişlerine uygun katmanlı giyim ve çantada katlanabilir şemsiye/yağmurluk.',
      afternoonEvening: '15:30–18:00 Şeytan Sofrası açık zirvesi için kalın polar + kapüşonlu rüzgarlık/yağmurluk mont, bere ve kaymaz tabanlı ayakkabı ZORUNLUDUR.',
      essentials: [
        'Kapüşonlu su ve rüzgâr geçirmez mont / yağmurluk (Şeytan Sofrası zirvesinde şemsiye rüzgârdan ters dönebilir, kapüşonlu mont şarttır)',
        'Kalın polar veya termal iç katman (Zirvede hissedilen sıcaklık 6–7°C)',
        'Bere veya boyunluk (Açık kayalık tepede kulak ve boyun koruması için)',
        'Kaymaz tabanlı, suya dayanıklı spor ayakkabı / bot'
      ]
    },
    activityRecommendations: [
      {
        title: 'Ayvalık Tarihi Sokaklar & Küçükköy Yürüyüşü (09:30 - 11:00)',
        detail: 'Sabah saatlerinde yağış ihtimali düşük (%20), hava bulutlu ve 12–13°C. Yürüyüş ve fotoğraf çekimi için elverişli.',
        badge: 'Sabah Uygun'
      },
      {
        title: 'Sabancı Üniversitesi Küçükköy Atölyesi (11:00 - 14:30)',
        detail: 'Öğle saatlerinde başlayabilecek hafif yağmur geçişleri (%45) sırasında atölye çalışmaları kapalı teknoloji merkezinde güvenle yapılacak.',
        badge: 'Kapalı Atölye Avantajı'
      },
      {
        title: 'Şeytan Sofrası Panoramik Gözlem (15:30 - 17:45)',
        detail: 'Yüksek rakım ve açık deniz cephesi nedeniyle rüzgâr hamleleri 42 km/s hıza ulaşır. Kayalık korkuluklara yaklaşırken dikkatli olunmalı ve kapüşonlu mont giyilmeli.',
        badge: 'Kuvvetli Rüzgâr Uyarısı'
      }
    ],
    microClimates: [
      {
        zoneName: 'Ayvalık Tarihi Merkez',
        timeWindow: '09:00 – 11:00',
        tempRange: '11°C → 13°C',
        windInfo: '18 km/s KKD',
        rainRisk: '%25',
        advice: 'Dar taş sokaklar rüzgârı keser ancak gökyüzü kapalı; hafif montla rahat yürüyüş yapılabilir.'
      },
      {
        zoneName: 'Küçükköy (Yeniçarohori) & Sabancı Üni. Kampüsü',
        timeWindow: '11:00 – 15:00',
        tempRange: '14°C → 15°C',
        windInfo: '22 km/s KKD',
        rainRisk: '%45 (Hafif Sağanak Geçişi)',
        advice: 'Atölye binaları ve sanat galerileri arası geçişlerde kapüşonlu yağmurluğunuzu hazır tutun.'
      },
      {
        zoneName: 'Şeytan Sofrası Zirvesi (Yüksek Rakım)',
        timeWindow: '15:30 – 18:00',
        tempRange: '11°C (Hissedilen 6°C)',
        windInfo: '28 km/s (Hamle 42 km/s)',
        rainRisk: '%35',
        advice: 'Ayvalık merkezden 3–4°C daha soğuk ve çok daha rüzgârlıdır. Polar + rüzgarlık + bere kombinasyonu kullanılmalı.'
      }
    ],
    hourly: [
      { hour: '00:00', temp: 10, feelsLike: 8, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 15, windGust: 22, windDir: 'KKD', humidity: 78, cloudCover: 50, pressure: 1017, hourlyTip: 'Gece bulutluluk artıyor.' },
      { hour: '01:00', temp: 10, feelsLike: 8, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 15, windGust: 22, windDir: 'KKD', humidity: 79, cloudCover: 55, pressure: 1016, hourlyTip: 'Gece sakin ve serin.' },
      { hour: '02:00', temp: 10, feelsLike: 8, precipProb: 20, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 16, windGust: 23, windDir: 'KKD', humidity: 80, cloudCover: 65, pressure: 1016, hourlyTip: 'Bulutlu gece.' },
      { hour: '03:00', temp: 9, feelsLike: 7, precipProb: 20, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 16, windGust: 24, windDir: 'KKD', humidity: 81, cloudCover: 70, pressure: 1015, hourlyTip: 'Günün en düşük sıcaklığı (9°C).' },
      { hour: '04:00', temp: 9, feelsLike: 7, precipProb: 20, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 17, windGust: 25, windDir: 'KKD', humidity: 81, cloudCover: 72, pressure: 1015, hourlyTip: 'Sabaha karşı serin hava.' },
      { hour: '05:00', temp: 9, feelsLike: 7, precipProb: 20, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 17, windGust: 25, windDir: 'KKD', humidity: 82, cloudCover: 75, pressure: 1015, hourlyTip: 'Sabah öncesi bulutlu.' },
      { hour: '06:00', temp: 9, feelsLike: 7, precipProb: 25, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 18, windGust: 26, windDir: 'KKD', humidity: 81, cloudCover: 75, pressure: 1015, hourlyTip: 'Sabah erken saatlerde kapalı gökyüzü.' },
      { hour: '07:00', temp: 10, feelsLike: 8, precipProb: 25, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 18, windGust: 27, windDir: 'KKD', humidity: 80, cloudCover: 78, pressure: 1015, hourlyTip: 'Uyanış ve hazırlık: bugün çantanıza mutlaka yağmurluk ve polar koyun.' },
      { hour: '08:00', temp: 11, feelsLike: 9, precipProb: 25, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 19, windGust: 28, windDir: 'KKD', humidity: 78, cloudCover: 78, pressure: 1015, programTitle: 'Otelde Açık Büfe Kahvaltı', programLocation: '4* Bacacan Otel', hourlyTip: 'Kahvaltı sonrası dışarı çıkarken su geçirmez montunuzu giyin.', isKeyProgramHour: true },
      { hour: '09:00', temp: 12, feelsLike: 10, precipProb: 25, precipMm: 0, weatherCode: 3, condition: 'Kapalı', windSpeed: 20, windGust: 29, windDir: 'KKD', humidity: 76, cloudCover: 80, pressure: 1014, programTitle: 'Ayvalık Tarihi Merkez Yürüyüşü', programLocation: 'Ayvalık Merkez', hourlyTip: 'Kapalı ama yağışsız sabah; yürüyüş için uygun.', isKeyProgramHour: true },
      { hour: '10:00', temp: 13, feelsLike: 11, precipProb: 30, precipMm: 0.1, weatherCode: 3, condition: 'Kapalı', windSpeed: 21, windGust: 31, windDir: 'KKD', humidity: 75, cloudCover: 82, pressure: 1014, programTitle: 'Küçükköy (Yeniçarohori) Kültür Turu', programLocation: 'Küçükköy Sanat Köyü', hourlyTip: 'Küçükköy taş sokaklarında hafif esinti ve kapalı hava.' },
      { hour: '11:00', temp: 14, feelsLike: 12, precipProb: 35, precipMm: 0.2, weatherCode: 51, condition: 'Hafif Çiseleme İhtimali', windSpeed: 22, windGust: 33, windDir: 'KKD', humidity: 74, cloudCover: 85, pressure: 1014, programTitle: 'Sabancı Üni. Yaratıcı Teknolojiler Atölyesi', programLocation: 'Sabancı Üni. Küçükköy Merkezi', hourlyTip: 'Atölye başlangıcında dışarıda hafif çiseleme başlayabilir; iç mekânda çalışma yapılacak.', isKeyProgramHour: true },
      { hour: '12:00', temp: 15, feelsLike: 13, precipProb: 40, precipMm: 0.5, weatherCode: 61, condition: 'Arada Hafif Yağmurlu', windSpeed: 24, windGust: 35, windDir: 'KKD', humidity: 75, cloudCover: 88, pressure: 1013, programTitle: 'Yaratıcı Teknolojiler & Sürdürülebilirlik Çalışması', programLocation: 'Sabancı Üni. Küçükköy Merkezi', hourlyTip: 'Öğle saatinde dışarıda kısa süreli yağmur geçişi; bina geçişlerinde kapüşon kullanın.', isKeyProgramHour: true },
      { hour: '13:00', temp: 15, feelsLike: 13, precipProb: 45, precipMm: 0.8, weatherCode: 61, condition: 'Hafif Yağmur Geçişi', windSpeed: 25, windGust: 37, windDir: 'KKD', humidity: 77, cloudCover: 88, pressure: 1013, programTitle: 'Öğle Yemeği & Küçükköy Galerileri', programLocation: 'Küçükköy', hourlyTip: 'Günün yağış olasılığı en yüksek saati (%45); su geçirmez ayakkabı avantaj sağlar.', isKeyProgramHour: true },
      { hour: '14:00', temp: 14, feelsLike: 11, precipProb: 40, precipMm: 0.5, weatherCode: 51, condition: 'Çiseleme / Çok Bulutlu', windSpeed: 26, windGust: 39, windDir: 'KKD', humidity: 76, cloudCover: 82, pressure: 1013, programTitle: 'Atölye Proje Sunumları', programLocation: 'Küçükköy', hourlyTip: 'Yağış hafifliyor ancak rüzgâr kuvvetlenmeye başlıyor.' },
      { hour: '15:00', temp: 13, feelsLike: 9, precipProb: 35, precipMm: 0.2, weatherCode: 3, condition: 'Çok Bulutlu & Rüzgârlı', windSpeed: 27, windGust: 41, windDir: 'KKD', humidity: 74, cloudCover: 78, pressure: 1014, programTitle: 'Şeytan Sofrası Zirvesine Hareket', programLocation: 'Şeytan Sofrası Yolu', hourlyTip: 'Zirveye çıkarken polar + rüzgarlık + bere katmanlarınızı tam giyin!', isKeyProgramHour: true },
      { hour: '16:00', temp: 12, feelsLike: 7, precipProb: 30, precipMm: 0.1, weatherCode: 3, condition: 'Kuvvetli Rüzgâr & Bulutlu', windSpeed: 28, windGust: 42, windDir: 'KKD', humidity: 73, cloudCover: 75, pressure: 1014, programTitle: 'Şeytan Sofrası Ekoloji & Manzara Gözlemi', programLocation: 'Şeytan Sofrası Tepesi', hourlyTip: 'DİKKAT: Zirvede 42 km/s rüzgâr hamlesiyle hissedilen sıcaklık 6–7°C! Şemsiye yerine kapüşon kullanın.', isKeyProgramHour: true },
      { hour: '17:00', temp: 11, feelsLike: 6, precipProb: 25, precipMm: 0, weatherCode: 2, condition: 'Parçalı Çok Bulutlu & Rüzgârlı', windSpeed: 26, windGust: 39, windDir: 'KKD', humidity: 74, cloudCover: 68, pressure: 1015, programTitle: 'Gün Batımı Gözlemi & Otele Dönüş', programLocation: 'Şeytan Sofrası', hourlyTip: 'Gün batımında (17:43) bulut aralarından Midilli manzarası; tepe oldukça soğuk.', isKeyProgramHour: true },
      { hour: '18:00', temp: 11, feelsLike: 8, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 22, windGust: 33, windDir: 'KD', humidity: 75, cloudCover: 60, pressure: 1015, programTitle: 'Otelde Dinlenme & Hazırlık', programLocation: '4* Bacacan Otel', hourlyTip: 'Merkeze inince rüzgâr şiddeti azalıyor.' },
      { hour: '19:00', temp: 10, feelsLike: 8, precipProb: 20, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 20, windGust: 29, windDir: 'KD', humidity: 76, cloudCover: 55, pressure: 1016, programTitle: 'Grup Akşam Yemeği', programLocation: 'Ayvalık Restoran / Otel', hourlyTip: 'Akşam serinliği devam ediyor (10°C).', isKeyProgramHour: true },
      { hour: '20:00', temp: 10, feelsLike: 8, precipProb: 15, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 18, windGust: 26, windDir: 'KD', humidity: 76, cloudCover: 50, pressure: 1016, hourlyTip: 'Bulutlar dağılmaya başlıyor, yarınki hasat günü için hava açıyor.' },
      { hour: '21:00', temp: 10, feelsLike: 8, precipProb: 15, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 16, windGust: 24, windDir: 'KD', humidity: 77, cloudCover: 40, pressure: 1017, programTitle: '2. Gün CAS Team Reflection Toplantısı', programLocation: 'Bacacan Otel Toplantı Salonu', hourlyTip: 'Yarın sabah zeytin bahçesi arazisine uygun bot/spor ayakkabınızı hazırlayın.', isKeyProgramHour: true },
      { hour: '22:00', temp: 9, feelsLike: 7, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 15, windGust: 22, windDir: 'KD', humidity: 78, cloudCover: 35, pressure: 1017, hourlyTip: 'Açık ve serin gece.' },
      { hour: '23:00', temp: 9, feelsLike: 7, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 79, cloudCover: 30, pressure: 1018, hourlyTip: 'Gece istirahati.' }
    ]
  },
  {
    date: '2026-11-27',
    dayNumber: 3,
    dateLabel: '27 Kasım 2026, Cuma',
    shortDate: '27 Kasım Cuma',
    weekday: 'Cuma',
    routeTitle: 'Kürşat Ayvalık Zeytin Hasadı • Zeytinyağı Müzesi • İstanbul Dönüş',
    summaryCondition: 'Güneşli / Az Bulutlu, Toprak Nemli & Hasat İçin İdeal Sonbahar Havası',
    weatherCode: 1,
    tempMax: 16,
    tempMin: 8,
    feelsLikeMax: 16,
    feelsLikeMin: 7,
    precipProbMax: 10,
    precipSumMm: 0,
    windSpeedMax: 16,
    windGustMax: 24,
    windDirection: 'Kuzeydoğu (KD)',
    windDegrees: 50,
    humidityAvg: 64,
    uvIndexMax: 3,
    pressureHpa: 1020,
    visibilityKm: 10,
    cloudCoverAvg: 25,
    dewPoint: 7,
    seaTemp: 17.1,
    sunrise: '08:06',
    sunset: '17:42',
    isLiveApiSynced: false,
    alertLevel: 'moderate',
    alertTitle: 'Sabah Çiyli/Nemli Zeytinlik Zemini & Hasat Sonrası Kıyafet Değişimi',
    alertSummary:
      'Cuma günü yağış beklenmiyor (%10) ve güneş yüzünü gösteriyor (16°C). Ancak bir önceki günün yağışı ve sabah çiyi nedeniyle saat 09:30’da Kürşat Zeytin Bahçeleri’nde toprak zemin nemli/çamurlu olabilir. Araziye uygun ayakkabı giyilmeli ve dönüş otobüsü için temiz yedek kıyafet ayrılmalıdır.',
    clothingRecommendations: {
      morning: '08:00 Otel çıkışı ve 09:30 Zeytin Hasadı için sabah serinliğine (9–11°C) uygun sweatshirt/polar + rahat hareket edilen eşofman/kot pantolon ve toprak zemine uygun kapalı ayakkabı.',
      midday: '11:00–14:00 Zeytinyağı Endüstri Müzesi ve Ayvalık Çarşısı öğle yemeğinde güneşli 16°C havada hafif üst katman ve güneş gözlüğü.',
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
        detail: 'Gökyüzü açık, rüzgâr hafif (14 km/s) ve sıcaklık 12→14°C. Zeytin silkme ve toplama etkinliği için mükemmel açık hava koşulları; sadece zemin nemine dikkat edilmeli.',
        badge: 'Hasat İçin Mükemmel Hava'
      },
      {
        title: 'Zeytinyağı Endüstri Müzesi & Çarşı Serbest Zaman (11:00 - 14:30)',
        detail: 'Öğle saatlerinde 16°C güneşli hava ile Ayvalık çarşısında yürüyüş ve öğle yemeği oldukça keyifli geçecek.',
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
        tempRange: '11°C → 14°C',
        windInfo: '14 km/s KD',
        rainRisk: '%10 (Zeminde Sabah Çiyi)',
        advice: 'Ağaç altı ve çimenlik zemin sabah saatlerinde nemlidir; beyaz bez ayakkabı yerine koyu renk/dayanıklı ayakkabı giyin.'
      },
      {
        zoneName: 'Zeytinyağı Müzesi & Ayvalık Çarşı Merkezi',
        timeWindow: '11:00 – 14:30',
        tempRange: '15°C → 16°C',
        windInfo: '16 km/s KD',
        rainRisk: '%10',
        advice: 'Bol güneşli ve rüzgârı sakin öğle saatleri; dış mekânda öğle yemeği ve alışveriş için çok elverişli.'
      },
      {
        zoneName: 'Ayvalık – Bursa – İstanbul Dönüş Hattı',
        timeWindow: '14:30 – 20:00',
        tempRange: '16°C → 11°C',
        windInfo: '15 km/s KD',
        rainRisk: '%15',
        advice: 'Akşam 20:00’de İstanbul’da okul bahçesine varışta hava 11°C ve serin olacak; montunuzu araç içinde el altında tutun.'
      }
    ],
    hourly: [
      { hour: '00:00', temp: 9, feelsLike: 7, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 13, windGust: 19, windDir: 'KD', humidity: 78, cloudCover: 25, pressure: 1018, hourlyTip: 'Açık ve serin gece.' },
      { hour: '01:00', temp: 9, feelsLike: 7, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 79, cloudCover: 25, pressure: 1018, hourlyTip: 'Gece sakin hava.' },
      { hour: '02:00', temp: 8, feelsLike: 6, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 12, windGust: 17, windDir: 'KD', humidity: 80, cloudCover: 20, pressure: 1019, hourlyTip: 'Gece en düşük sıcaklık (8°C).' },
      { hour: '03:00', temp: 8, feelsLike: 6, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 81, cloudCover: 20, pressure: 1019, hourlyTip: 'Açık gökyüzü nedeniyle sabah çiyi oluşuyor.' },
      { hour: '04:00', temp: 8, feelsLike: 6, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 82, cloudCover: 20, pressure: 1019, hourlyTip: 'Sabah öncesi serinlik.' },
      { hour: '05:00', temp: 8, feelsLike: 6, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 11, windGust: 17, windDir: 'KD', humidity: 82, cloudCover: 20, pressure: 1019, hourlyTip: 'Sabah ayazı.' },
      { hour: '06:00', temp: 8, feelsLike: 6, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 80, cloudCover: 22, pressure: 1019, hourlyTip: 'Sabah erken saatlerde açık ama serin hava.' },
      { hour: '07:00', temp: 9, feelsLike: 7, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 77, cloudCover: 22, pressure: 1020, hourlyTip: 'Valiz hazırlığı: dönüş kıyafetlerinizi sırt çantanıza veya kolay ulaşılır bölmeye ayırın.' },
      { hour: '08:00', temp: 10, feelsLike: 9, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Güneşli / Az Bulutlu', windSpeed: 13, windGust: 19, windDir: 'KD', humidity: 73, cloudCover: 25, pressure: 1020, programTitle: 'Kahvaltı & Otelden Çıkış (Check-out)', programLocation: '4* Bacacan Otel', hourlyTip: 'Gün doğumuyla (08:06) birlikte güneşli bir sabah.', isKeyProgramHour: true },
      { hour: '09:00', temp: 12, feelsLike: 11, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Güneşli / Az Bulutlu', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 68, cloudCover: 25, pressure: 1020, programTitle: 'Zeytin Bahçelerine Transfer & Hasat Başlangıcı', programLocation: 'Kürşat Ayvalık Zeytin Bahçeleri', hourlyTip: 'Hasat alanında toprak nemli olabilir, araziye uygun ayakkabı giyin.', isKeyProgramHour: true },
      { hour: '10:00', temp: 14, feelsLike: 13, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Güneşli / Az Bulutlu', windSpeed: 15, windGust: 21, windDir: 'KD', humidity: 63, cloudCover: 25, pressure: 1020, programTitle: 'Kürşat Ayvalık ile Zeytin Hasadı Deneyimi', programLocation: 'Kürşat Zeytin Bahçeleri', hourlyTip: 'Güneşli 14°C; zeytin toplama çalışması için çok konforlu açık hava.', isKeyProgramHour: true },
      { hour: '11:00', temp: 15, feelsLike: 15, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Güneşli / Az Bulutlu', windSpeed: 15, windGust: 22, windDir: 'KD', humidity: 59, cloudCover: 25, pressure: 1020, programTitle: 'Zeytinyağı Endüstri Müzesi İncelemesi', programLocation: 'Zeytinyağı Müzesi', hourlyTip: 'Müze ziyareti sırasında hava 15°C ve güneşli.', isKeyProgramHour: true },
      { hour: '12:00', temp: 16, feelsLike: 16, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Güneşli / Az Bulutlu', windSpeed: 16, windGust: 23, windDir: 'KD', humidity: 56, cloudCover: 28, pressure: 1020, programTitle: 'Serbest Öğle Yemeği & Alışveriş', programLocation: 'Ayvalık Çarşısı', hourlyTip: 'Günün en ılıman saati (16°C); çarşıda açık havada öğle yemeği için harika.', isKeyProgramHour: true },
      { hour: '13:00', temp: 16, feelsLike: 16, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Güneşli / Az Bulutlu', windSpeed: 16, windGust: 24, windDir: 'KD', humidity: 55, cloudCover: 28, pressure: 1019, programTitle: 'Ayvalık Çarşısı & Yöresel Ürünler', programLocation: 'Ayvalık Merkez', hourlyTip: 'Otobüs kalkışı öncesi temiz yedek tişört/kıyafet değişimi yapabilirsiniz.' },
      { hour: '14:00', temp: 16, feelsLike: 15, precipProb: 10, precipMm: 0, weatherCode: 2, condition: 'Parçalı Az Bulutlu', windSpeed: 16, windGust: 23, windDir: 'KD', humidity: 57, cloudCover: 30, pressure: 1019, programTitle: 'İstanbul’a Hareket Hazırlığı', programLocation: 'Ayvalık', hourlyTip: '14:30 kalkış için otobüste toplanma; yol boyu hava açık.', isKeyProgramHour: true },
      { hour: '15:00', temp: 15, feelsLike: 14, precipProb: 10, precipMm: 0, weatherCode: 2, condition: 'Parçalı Az Bulutlu', windSpeed: 15, windGust: 22, windDir: 'KD', humidity: 60, cloudCover: 30, pressure: 1019, programTitle: 'Dönüş Yolculuğu', programLocation: 'Ayvalık - Balıkesir Hattı', hourlyTip: 'Açık ve güneşli yolculuk.' },
      { hour: '16:00', temp: 14, feelsLike: 13, precipProb: 10, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 14, windGust: 21, windDir: 'KD', humidity: 64, cloudCover: 32, pressure: 1019, programTitle: 'İhtiyaç & Dinlenme Molası', programLocation: 'Otoyol Dinlenme Tesisleri', hourlyTip: '16:30 mola tesisinde açık hava 13–14°C.', isKeyProgramHour: true },
      { hour: '17:00', temp: 13, feelsLike: 12, precipProb: 10, precipMm: 0, weatherCode: 2, condition: 'Parçalı Bulutlu', windSpeed: 14, windGust: 20, windDir: 'KD', humidity: 68, cloudCover: 35, pressure: 1020, hourlyTip: 'Gün batımı (17:42) sonrası sıcaklık düşüyor.' },
      { hour: '18:00', temp: 12, feelsLike: 11, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 13, windGust: 19, windDir: 'KD', humidity: 71, cloudCover: 30, pressure: 1020, hourlyTip: 'Osmangazi / Körfez geçişi; akşam serinliği.' },
      { hour: '19:00', temp: 11, feelsLike: 10, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 13, windGust: 18, windDir: 'KD', humidity: 73, cloudCover: 28, pressure: 1020, hourlyTip: 'İstanbul girişinde serin ve açık akşam.' },
      { hour: '20:00', temp: 11, feelsLike: 9, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 12, windGust: 18, windDir: 'KD', humidity: 74, cloudCover: 25, pressure: 1020, programTitle: 'Okula Varış ve Turun Sonu', programLocation: 'Okul Bahçesi', hourlyTip: 'Okul bahçesinde veli tesliminde hava 11°C ve açık; montunuzu giyerek inin.', isKeyProgramHour: true },
      { hour: '21:00', temp: 10, feelsLike: 9, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 12, windGust: 17, windDir: 'KD', humidity: 75, cloudCover: 25, pressure: 1020, hourlyTip: 'Gece sakin hava.' },
      { hour: '22:00', temp: 10, feelsLike: 8, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 76, cloudCover: 25, pressure: 1020, hourlyTip: 'Gece sakin hava.' },
      { hour: '23:00', temp: 9, feelsLike: 8, precipProb: 10, precipMm: 0, weatherCode: 1, condition: 'Çoğunlukla Açık', windSpeed: 11, windGust: 16, windDir: 'KD', humidity: 77, cloudCover: 25, pressure: 1020, hourlyTip: 'Gece sakin hava.' }
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
  const highRain = day.precipProbMax >= 40 || day.precipSumMm >= 1.5;
  const highWind = day.windGustMax >= 35 || day.windSpeedMax >= 25;
  const chillyNight = day.tempMin <= 10 || day.feelsLikeMin <= 7;

  if (day.dayNumber === 2 || (highRain && highWind)) {
    return {
      alertLevel: highRain || highWind ? 'high' : 'moderate',
      alertTitle: `Şeytan Sofrası Rüzgâr Hamlesi (${Math.round(day.windGustMax)} km/s) & Yağış İhtimali (%${Math.round(day.precipProbMax)})`,
      alertSummary: `26 Kasım Perşembe günü en yüksek sıcaklık ${Math.round(day.tempMax)}°C, en düşük ${Math.round(day.tempMin)}°C (hissedilen ${Math.round(day.feelsLikeMin)}°C). Öğleden sonra %${Math.round(day.precipProbMax)} yağış ihtimali ve Şeytan Sofrası zirvesinde ${Math.round(day.windGustMax)} km/s rüzgâr hamlesine karşı kapüşonlu su/rüzgâr geçirmez mont ve polar zorunludur.`,
      clothingRecommendations: day.clothingRecommendations
    };
  }

  if (day.dayNumber === 1) {
    return {
      alertLevel: highRain ? 'moderate' : 'low',
      alertTitle: `Cunda Sahili Akşam Serinliği (${Math.round(day.tempMin)}°C) & ${day.windDirection} Esintisi`,
      alertSummary: `25 Kasım Çarşamba günü Kardeş Okul atölyelerinde sıcaklık ${Math.round(day.tempMax)}°C civarında ılıman seyredecek (Yağış olasılığı: %${Math.round(day.precipProbMax)}). Akşam Cunda Adası sahilinde ${Math.round(day.windGustMax)} km/s rüzgâr hamlesiyle hissedilen sıcaklık ${Math.round(day.feelsLikeMin)}°C’ye düşeceğinden katmanlı giyim ve rüzgarlık önerilir.`,
      clothingRecommendations: day.clothingRecommendations
    };
  }

  return {
    alertLevel: highRain ? 'moderate' : chillyNight ? 'moderate' : 'low',
    alertTitle: `Kürşat Zeytin Hasadı Zemini & Sabah Serinliği (${Math.round(day.tempMin)}°C → ${Math.round(day.tempMax)}°C)`,
    alertSummary: `27 Kasım Cuma günü yağış olasılığı %${Math.round(day.precipProbMax)}, gündüz sıcaklığı ${Math.round(day.tempMax)}°C. Sabah 09:30 zeytin hasadında çiyli/nemli toprak zemine uygun kapalı spor ayakkabı/bot giyilmeli ve 14:30 İstanbul dönüş otobüsü için temiz yedek kıyafet bulundurulmalıdır.`,
    clothingRecommendations: day.clothingRecommendations
  };
}

/**
 * Merges live Open-Meteo forecast rows (when 25–27 Kasım enters the live forecast window
 * or when updated model runs arrive) directly over the 25–27 Kasım baseline so the UI
 * always stays synchronized with the newest meteorological data.
 */
export function mergeLiveForecastWith25To27Baseline(
  baseline: TripDayForecast[],
  liveDaily: WeatherRow[] | undefined,
  liveHourly: WeatherRow[] | undefined
): TripDayForecast[] {
  if (!liveDaily && !liveHourly) return baseline;

  return baseline.map(day => {
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
      const code = hv.weather_code != null ? Math.round(hv.weather_code) : slot.weatherCode;
      return {
        ...slot,
        temp: hv.temperature_2m != null ? Math.round(hv.temperature_2m * 10) / 10 : slot.temp,
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
        condition: hv.weather_code != null ? weatherLabel(code) : slot.condition,
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
    const mergedCode =
      dv.weather_code != null ? Math.round(dv.weather_code) : day.weatherCode;

    const updatedDay: TripDayForecast = {
      ...day,
      isLiveApiSynced: true,
      weatherCode: mergedCode,
      summaryCondition: dv.weather_code != null ? weatherLabel(mergedCode) : day.summaryCondition,
      tempMax: dv.temperature_2m_max != null ? Math.round(dv.temperature_2m_max * 10) / 10 : day.tempMax,
      tempMin: dv.temperature_2m_min != null ? Math.round(dv.temperature_2m_min * 10) / 10 : day.tempMin,
      feelsLikeMax:
        dv.apparent_temperature_max != null
          ? Math.round(dv.apparent_temperature_max * 10) / 10
          : day.feelsLikeMax,
      feelsLikeMin:
        dv.apparent_temperature_min != null
          ? Math.round(dv.apparent_temperature_min * 10) / 10
          : day.feelsLikeMin,
      precipProbMax:
        dv.precipitation_probability_max != null
          ? Math.round(dv.precipitation_probability_max)
          : day.precipProbMax,
      precipSumMm:
        dv.precipitation_sum != null
          ? Math.round(dv.precipitation_sum * 10) / 10
          : day.precipSumMm,
      windSpeedMax:
        dv.wind_speed_10m_max != null
          ? Math.round(dv.wind_speed_10m_max * 10) / 10
          : day.windSpeedMax,
      windGustMax:
        dv.wind_gusts_10m_max != null
          ? Math.round(dv.wind_gusts_10m_max * 10) / 10
          : day.windGustMax,
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
  const [loading, setLoading] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>('');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>('2026-11-25');
  const [hourlyViewMode, setHourlyViewMode] = useState<'program' | 'all24'>('program');
  const [modalDayDate, setModalDayDate] = useState<string | null>(null);
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const refreshRef = useRef<(force?: boolean) => void>(() => {});

  useEffect(() => {
    let mounted = true;
    let busy = false;
    let lastAttempt = 0;
    const abort = new AbortController();

    const syncWeather = async (force = false) => {
      if (busy || (!force && Date.now() - lastAttempt < WEATHER_REFRESH_MS)) return;
      busy = true;
      lastAttempt = Date.now();
      setLoading(true);
      try {
        const response = await fetch(getApiUrl('/api/ayvalik/weather'), {
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
        if (mounted) {
          setSnapshot({
            data: result.data,
            fetchedAt: result.fetchedAt,
            stale: result.stale === true
          });
          setSyncError('');
        }
      } catch {
        if (abort.signal.aborted) return;
        try {
          const directRes = await fetch(WEATHER_URL, {
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]),
            cache: 'no-store',
          });
          if (!directRes.ok) throw Error('Open-Meteo yanıt vermedi.');
          const data = parseWeather(await directRes.json());
          if (mounted) {
            setSnapshot({ data, fetchedAt: Date.now(), stale: false });
            setSyncError('');
          }
        } catch {
          if (mounted) {
            setSnapshot(previous => previous ? { ...previous, stale: true } : previous);
            setSyncError('Canlı veri alınamadı. Varsa son kaydedilen tahminler gösteriliyor.');
          }
        }
      } finally {
        busy = false;
        if (mounted) setLoading(false);
      }
    };

    refreshRef.current = syncWeather;
    void syncWeather(true);

    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void syncWeather(false);
    }, WEATHER_REFRESH_MS);

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
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Merge baseline 25-27 Kasım forecast with any live API updates for 2026-11-25..27
  const tripDays = useMemo(() => {
    return mergeLiveForecastWith25To27Baseline(
      BASELINE_25_27_KASIM,
      snapshot?.data?.daily,
      snapshot?.data?.hourly
    );
  }, [snapshot]);

  const activeDetailDay = useMemo(() => {
    const target = modalDayDate || selectedDayDate || '2026-11-25';
    return tripDays.find(d => d.date === target) || tripDays[0];
  }, [tripDays, selectedDayDate, modalDayDate]);

  const liveSyncedCount = tripDays.filter(d => d.isLiveApiSynced).length;

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
                  {day.dayNumber}. Gezi Günü Spesifik Raporu
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 text-sky-200 text-xs font-bold flex items-center gap-1.5">
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  {day.isLiveApiSynced
                    ? (snapshot?.stale ? 'Son kaydedilen tahmin' : 'Open-Meteo tahmini')
                    : 'Canlı tahmin henüz yok · planlama örneği'}
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
          {/* 1. Specific Meteorological Metrics Grid (8 Detailed Parameters) */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
              <Gauge size={14} className="text-emerald-500" />
              <span>{day.shortDate} • Spesifik Atmosfer ve Meteoroloji Parametreleri</span>
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
                  <span>{day.shortDate} • Saat Saat Spesifik Hava Durumu ve Gezi Akışı</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Her saatin sıcaklığı, hissedilen değeri, yağış olasılığı, rüzgâr hamlesi ve o saatteki gezi etkinliğine özel giyim uyarısı
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
                            slot.precipProb >= 40
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
      {/* Header & Live Auto-Sync Status Bar */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 text-white border border-emerald-500/25 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
                <Calendar size={13} /> SADECE 25 – 27 KASIM 2026 GEZİ GÜNLERİ
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {liveSyncedCount > 0
                  ? `${liveSyncedCount}/3 gün için ${snapshot?.stale ? "önbellekteki" : "Open-Meteo"} tahmini`
                  : 'Otomatik Tahmin Senkronizasyonu Aktif'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <CloudSun className="text-emerald-400 shrink-0" size={28} />
              <span>25–27 Kasım Ayvalık CAS Detaylı Hava Durumu & Giyim Rehberi</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Aşağıdaki 3 gezi gününden herhangi birinin üzerine tıklayarak o günün{' '}
              <strong className="text-white">saat saat (00:00–23:00) spesifik hava durumunu</strong>,{' '}
              <strong className="text-white">bölgesel mikro-iklim analizini</strong> (Cunda, Küçükköy, Şeytan Sofrası, Kürşat Zeytinlikleri) ve{' '}
              <strong className="text-white">hava durumuna özel giyim/aktivite önerilerini</strong> detaylı kartta inceleyebilirsiniz.
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
              <span>{loading ? 'Senkronize Ediliyor...' : 'Tahminleri Şimdi Senkronize Et'}</span>
            </button>
            <div className="text-[11px] text-emerald-200/90 text-right">
              {snapshot
                ? `Son başarılı veri alımı: ${formatSyncTimestamp(snapshot.fetchedAt)}`
                : 'Open-Meteo Ayvalık (39.32°K, 26.70°D) ile otomatik senkronize'}
            </div>
          </div>
        </div>

        {/* Synchronization Explanation Banner */}
        <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-100">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
            <span>
              <strong>Tahmin güncellemesi:</strong> Sayfa açıkken Open-Meteo 15 dakikada bir kontrol edilir. Tahmin aralığına henüz girmeyen günler planlama örneği olarak etiketlenir.
            </span>
          </div>
          {snapshot && <span>Ayvalık {snapshot.stale ? '· son kaydedilen değer' : '· güncel model değeri'} · {weatherNumber(snapshot.data.current.values.temperature_2m, ' °C')} · {formatSyncTimestamp(weatherTime(snapshot.data.current.time))}</span>}
          {syncError && (
            <span className="text-amber-300 font-semibold">{syncError}</span>
          )}
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
                  </div>
                </div>

                {/* Quick Metrics 2x3 Grid */}
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
                  <span>Saatlik & Spesifik Hava Kartını Aç</span>
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
