import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Wind,
  Droplets,
  Eye,
  Gauge,
  Compass,
  Sunrise,
  Sunset,
  Thermometer,
  ShieldAlert,
  Umbrella,
  CloudRain,
  ChevronRight,
  ChevronLeft,
  Sun,
  AlertTriangle,
  Clock,
  Calendar,
  X,
} from 'lucide-react';
import WeatherIcon from './WeatherIcon';
import {
  WeatherData,
  WeatherLocation,
  DailyForecastItem,
  HourlyForecastItem,
  DEFAULT_ISTANBUL_LOCATION,
  fetchWeatherForecast,
  reverseGeocode,
  searchLocations,
  getCachedWeather,
  saveCachedWeather,
  getSavedWeatherLocation,
  saveWeatherLocation,
  getWeatherMeta,
  getUVLevelText,
  getWindDirectionText,
} from '../utils/weatherService';

interface WeatherDashboardProps {
  darkMode?: boolean;
  onBackToMain?: () => void;
}

export default function WeatherDashboard({ darkMode, onBackToMain }: WeatherDashboardProps) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(() => getCachedWeather());
  const [currentLocation, setCurrentLocation] = useState<WeatherLocation>(() => {
    return getSavedWeatherLocation() || DEFAULT_ISTANBUL_LOCATION;
  });

  const [loading, setLoading] = useState<boolean>(!weatherData);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [detectingGps, setDetectingGps] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Hourly Scroll & Mouse Drag-to-Scroll State
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingHourly, setIsDraggingHourly] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragScrollLeft, setDragScrollLeft] = useState<number>(0);

  // Selected Day for Detail Pop-up Modal
  const [selectedDay, setSelectedDay] = useState<DailyForecastItem | null>(null);

  // Load weather for location
  const loadWeather = async (loc: WeatherLocation, isSilent = false) => {
    if (!isSilent) setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchWeatherForecast(loc.latitude, loc.longitude, loc.name);
      setWeatherData(data);
      saveCachedWeather(data);
      saveWeatherLocation(loc);
    } catch (err: any) {
      setErrorMsg('Hava durumu verisi alınamadı. İnternet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!weatherData) {
      loadWeather(currentLocation);
    } else {
      // Re-fetch silently if cache is older than 20 minutes
      const age = Date.now() - (weatherData.lastUpdated || 0);
      if (age > 20 * 60 * 1000) {
        loadWeather(currentLocation, true);
      }
    }
  }, []);

  // Periodic Auto-refresh every 20 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadWeather(currentLocation, true);
    }, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentLocation]);

  // GPS / Geolocation detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Cihazınızda konum servisi desteklenmiyor. İstanbul varsayılan olarak kullanılmaktadır.');
      return;
    }

    setDetectingGps(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        try {
          const geo = await reverseGeocode(lat, lon);
          const newLoc: WeatherLocation = {
            name: geo.displayName,
            district: geo.district,
            city: geo.city,
            latitude: lat,
            longitude: lon,
            isDefault: false,
          };
          setCurrentLocation(newLoc);
          await loadWeather(newLoc);
        } catch {
          const fallbackLoc: WeatherLocation = {
            name: `${lat.toFixed(2)}°K, ${lon.toFixed(2)}°D`,
            latitude: lat,
            longitude: lon,
            isDefault: false,
          };
          setCurrentLocation(fallbackLoc);
          await loadWeather(fallbackLoc);
        } finally {
          setDetectingGps(false);
        }
      },
      () => {
        setDetectingGps(false);
        setCurrentLocation(DEFAULT_ISTANBUL_LOCATION);
        loadWeather(DEFAULT_ISTANBUL_LOCATION);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  // City Search Debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
      setShowSearchDropdown(true);
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Select location from search
  const handleSelectLocation = (loc: WeatherLocation) => {
    setCurrentLocation(loc);
    setShowSearchDropdown(false);
    setSearchQuery('');
    loadWeather(loc);
  };

  // Manual Refresh
  const handleManualRefresh = () => {
    setRefreshing(true);
    loadWeather(currentLocation, false);
  };

  // Hourly Scroll Controls (Smooth Button Scroll)
  const scrollHourly = (direction: 'left' | 'right') => {
    if (!hourlyScrollRef.current) return;
    const scrollAmount = 360;
    hourlyScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Mouse Drag-to-Scroll Handlers for Hourly Forecast
  const handleMouseDownHourly = (e: React.MouseEvent) => {
    if (!hourlyScrollRef.current) return;
    setIsDraggingHourly(true);
    setDragStartX(e.pageX - hourlyScrollRef.current.offsetLeft);
    setDragScrollLeft(hourlyScrollRef.current.scrollLeft);
  };

  const handleMouseLeaveHourly = () => {
    setIsDraggingHourly(false);
  };

  const handleMouseUpHourly = () => {
    setIsDraggingHourly(false);
  };

  const handleMouseMoveHourly = (e: React.MouseEvent) => {
    if (!isDraggingHourly || !hourlyScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - hourlyScrollRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    hourlyScrollRef.current.scrollLeft = dragScrollLeft - walk;
  };

  // Keyboard shortcut to close Modal (ESC key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDay) {
        setSelectedDay(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDay]);

  // Calculate week-wide min & max for 7-day temperature range bars
  const weekTempRange = useMemo(() => {
    if (!weatherData || !weatherData.daily || weatherData.daily.length === 0) {
      return { min: 0, max: 30 };
    }
    const allMins = weatherData.daily.map((d) => d.temperatureMin);
    const allMaxs = weatherData.daily.map((d) => d.temperatureMax);
    return {
      min: Math.min(...allMins),
      max: Math.max(...allMaxs),
    };
  }, [weatherData]);

  // Current weather meta info (gradient & labels)
  const weatherMeta = useMemo(() => {
    if (!weatherData) return getWeatherMeta(0, true);
    return getWeatherMeta(weatherData.current.weatherCode, weatherData.current.isDay);
  }, [weatherData]);

  // Filter 24 hours for selected day in modal
  const selectedDayHourlyList = useMemo(() => {
    if (!selectedDay || !weatherData) return [];
    const datePrefix = selectedDay.date.substring(0, 10);
    const sourceList = weatherData.allHourly && weatherData.allHourly.length > 0 ? weatherData.allHourly : weatherData.hourly;
    const filtered = sourceList.filter((h) => h.time.startsWith(datePrefix));
    if (filtered.length > 0) return filtered;
    return sourceList.slice(0, 24);
  }, [selectedDay, weatherData]);

  return (
    <div className={`w-full h-full flex flex-col ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} dark:bg-slate-950 dark:text-slate-100 overflow-y-auto font-sans select-none transition-colors duration-200`}>
      {/* ====================================================================== */}
      {/* 1. TOP HEADER & LOCATION CONTROLS BAR */}
      {/* ====================================================================== */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-6 py-3 shrink-0 shadow-xs transition-colors duration-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Location Badge & GPS status */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <MapPin size={20} className="animate-pulse" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate max-w-[220px] sm:max-w-xs">
                  {currentLocation.name}
                </span>
                {currentLocation.isDefault && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                    Varsayılan
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {weatherData
                  ? `Son Güncelleme: ${new Date(weatherData.lastUpdated).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Yükleniyor...'}
              </span>
            </div>
          </div>

          {/* Search Box & Quick Controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end relative">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs focus-within:border-blue-500 transition-colors shadow-inner">
                <Search size={15} className="text-slate-400 shrink-0 mr-2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  placeholder="İl veya ilçe ara..."
                  className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search Dropdown Results */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/60 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
                  {searchResults.map((loc, idx) => (
                    <button
                      key={`search-res-${idx}`}
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {loc.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {loc.latitude.toFixed(2)}°K, {loc.longitude.toFixed(2)}°D
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* GPS Detect Location Button */}
            <button
              onClick={handleDetectLocation}
              disabled={detectingGps}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0 disabled:opacity-50"
              title="Mevcut Konumumu Kullan"
            >
              <Navigation size={14} className={detectingGps ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Konumumu Bul</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
              title="Yenile"
            >
              <RefreshCw size={15} className={refreshing || loading ? 'animate-spin text-blue-500' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================== */}
      {/* 2. MAIN CONTENT AREA */}
      {/* ====================================================================== */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Error Notice */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-white cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && !weatherData && (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <RefreshCw size={36} className="text-blue-500 animate-spin" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Meteorolojik veriler alınıyor...</p>
          </div>
        )}

        {weatherData && (
          <>
            {/* ---------------------------------------------------------------- */}
            {/* HERO CARD: Apple Weather Style Fluid Gradient Card */}
            {/* ---------------------------------------------------------------- */}
            <section
              className={`relative rounded-3xl p-6 sm:p-8 overflow-hidden shadow-xl sm:shadow-2xl bg-gradient-to-br ${
                weatherData.current.isDay ? weatherMeta.bgGradientDay : weatherMeta.bgGradientNight
              } transition-all duration-700 border border-white/20`}
            >
              {/* Subtle Atmospheric Light Effect */}
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-black/20 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                {/* Left: Location & Condition */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-widest font-black text-white/90">
                      {weatherData.location.name}
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-sm">
                    {weatherMeta.label}
                  </h1>

                  <p className="text-xs sm:text-sm text-white/95 max-w-md font-medium leading-relaxed">
                    {weatherMeta.description}
                  </p>

                  <div className="pt-2 flex items-center gap-3 sm:gap-4 text-xs font-semibold text-white/90 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Thermometer size={14} />
                      Hissedilen: <strong className="text-white">{weatherData.current.apparentTemperature}°C</strong>
                    </span>
                    <span>•</span>
                    <span>
                      En Yüksek: <strong className="text-white">{weatherData.daily[0]?.temperatureMax}°C</strong>
                    </span>
                    <span>•</span>
                    <span>
                      En Düşük: <strong className="text-white">{weatherData.daily[0]?.temperatureMin}°C</strong>
                    </span>
                  </div>
                </div>

                {/* Right: Big Temperature & Big Dynamic Icon */}
                <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-center">
                  <div className="p-3 sm:p-4 rounded-3xl bg-white/15 backdrop-blur-md border border-white/25 shadow-xl">
                    <WeatherIcon
                      code={weatherData.current.weatherCode}
                      isDay={weatherData.current.isDay}
                      size={54}
                    />
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-5xl sm:text-7xl font-black tracking-tighter text-white drop-shadow-md">
                      {weatherData.current.temperature}°
                    </span>
                    <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                      Santigrat (°C)
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* CRITICAL WEATHER ALERTS BANNER (If Active) */}
            {/* ---------------------------------------------------------------- */}
            {weatherData.alerts.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <ShieldAlert size={16} />
                  <span>Meteorolojik Erken Uyarılar ({weatherData.alerts.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {weatherData.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-2xl border backdrop-blur-md shadow-sm transition-all flex items-start gap-3 ${
                        alert.severity === 'danger'
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/40 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          alert.severity === 'danger'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        <AlertTriangle size={20} className="animate-bounce" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{alert.title}</h4>
                        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{alert.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* HOURLY FORECAST (Next 24-36 Hours) WITH DESKTOP SCROLL BUTTONS */}
            {/* ---------------------------------------------------------------- */}
            <section className="bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-sm dark:shadow-xl backdrop-blur-md space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <Clock size={16} className="text-blue-500 dark:text-blue-400" />
                  <span>Saatlik Hava Tahmini & Yağış Olasılığı</span>
                </div>

                {/* Desktop Left/Right Navigation Scroll Arrows */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => scrollHourly('left')}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Geriye Kaydır"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => scrollHourly('right')}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="İleriye Kaydır"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Scrollable Hourly Row with Mouse Drag-to-Scroll */}
              <div
                ref={hourlyScrollRef}
                onMouseDown={handleMouseDownHourly}
                onMouseLeave={handleMouseLeaveHourly}
                onMouseUp={handleMouseUpHourly}
                onMouseMove={handleMouseMoveHourly}
                className={`flex items-center gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar touch-pan-x select-none ${
                  isDraggingHourly ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                {weatherData.hourly.map((hour, idx) => {
                  const isCurrentHour = idx === 0;
                  return (
                    <div
                      key={`hour-slot-${idx}`}
                      className={`flex flex-col items-center justify-between min-w-[76px] sm:min-w-[82px] p-3 rounded-2xl border transition-all shrink-0 ${
                        isCurrentHour
                          ? 'bg-blue-50 dark:bg-blue-600/30 border-blue-400 dark:border-blue-500/50 shadow-sm ring-1 ring-blue-400/50'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <span className={`text-[11px] font-black ${isCurrentHour ? 'text-blue-600 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}>
                        {hour.hourLabel}
                      </span>

                      <div className="my-2.5">
                        <WeatherIcon code={hour.weatherCode} isDay={hour.isDay} size={26} />
                      </div>

                      <span className="font-black text-sm text-slate-900 dark:text-white">{hour.temperature}°</span>

                      {/* Rain Probability Pill */}
                      <div className="mt-2 flex items-center gap-0.5">
                        {hour.precipitationProbability > 0 ? (
                          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                            <Droplets size={10} />
                            %{hour.precipitationProbability}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* 7-DAY FORECAST (CLICKABLE) & METRICS GRID */}
            {/* ---------------------------------------------------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Left Column: 7-Day Forecast (Apple Weather Bar Style - Click opens Detail Modal) */}
              <section className="lg:col-span-1 bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-sm dark:shadow-xl backdrop-blur-md flex flex-col justify-between space-y-3 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    <Calendar size={16} className="text-emerald-500 dark:text-emerald-400" />
                    <span>7 Günlük Tahmin</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700/50">
                    Detay için tıkla
                  </span>
                </div>

                <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-700/60">
                  {weatherData.daily.map((day, dIdx) => {
                    const totalSpan = Math.max(1, weekTempRange.max - weekTempRange.min);
                    const leftPct = Math.round(((day.temperatureMin - weekTempRange.min) / totalSpan) * 100);
                    const widthPct = Math.max(15, Math.round(((day.temperatureMax - day.temperatureMin) / totalSpan) * 100));

                    return (
                      <div
                        key={`day-slot-${dIdx}`}
                        onClick={() => setSelectedDay(day)}
                        className="pt-2 first:pt-0 flex items-center justify-between text-xs sm:text-sm font-semibold p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/50 cursor-pointer transition-all group"
                        title={`${day.dayLabel} gününün 24 saatlik detaylı raporunu görüntüle`}
                      >
                        {/* Day Name */}
                        <span className="w-20 font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {day.dayLabel}
                        </span>

                        {/* Weather Icon & Rain % */}
                        <div className="flex items-center gap-1 w-16 justify-center">
                          <WeatherIcon code={day.weatherCode} isDay={true} size={20} />
                          {day.precipitationProbabilityMax > 15 && (
                            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                              %{day.precipitationProbabilityMax}
                            </span>
                          )}
                        </div>

                        {/* Min Temp */}
                        <span className="w-8 text-right font-mono text-slate-400 text-xs">
                          {day.temperatureMin}°
                        </span>

                        {/* Relative Temperature Spectrum Pill Bar */}
                        <div className="flex-1 mx-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full relative overflow-hidden">
                          <div
                            className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-blue-400 via-amber-400 to-rose-400"
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                          />
                        </div>

                        {/* Max Temp */}
                        <span className="w-8 text-left font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {day.temperatureMax}°
                        </span>

                        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors ml-1" />
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Right Column: Detailed Meteorological Metrics Grid (2x3 Grid) */}
              <section className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* 1. UV Index */}
                {(() => {
                  const todayUV = weatherData.daily[0]?.uvIndexMax || 0;
                  const uvMeta = getUVLevelText(todayUV);
                  return (
                    <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-sm dark:shadow-lg backdrop-blur-md flex flex-col justify-between space-y-3 transition-colors">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Sun size={16} className="text-amber-500" />
                          UV İndeksi
                        </span>
                        <span className={`font-black ${uvMeta.color}`}>{uvMeta.text}</span>
                      </div>
                      <div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">
                          {todayUV} <span className="text-xs font-normal text-slate-400">/ 11+</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{uvMeta.desc}</p>
                      </div>
                      {/* UV Bar */}
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 rounded-full"
                          style={{ width: `${Math.min(100, (todayUV / 11) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Wind & Gusts */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-sm dark:shadow-lg backdrop-blur-md flex flex-col justify-between space-y-3 transition-colors">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Wind size={16} className="text-sky-500 dark:text-sky-400" />
                      Rüzgar & Fırtına
                    </span>
                    <span className="text-slate-700 dark:text-white font-mono font-bold text-xs">{getWindDirectionText(weatherData.current.windDirection)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                        {weatherData.current.windSpeed} <span className="text-xs font-bold text-slate-400">km/s</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Rüzgar Hamlesi: <strong className="text-slate-800 dark:text-slate-200">{weatherData.current.windGusts} km/s</strong>
                      </p>
                    </div>
                    {/* Wind Compass Indicator */}
                    <div className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 flex items-center justify-center relative shadow-inner">
                      <Compass
                        size={24}
                        className="text-sky-500 dark:text-sky-400 transition-transform duration-500"
                        style={{ transform: `rotate(${weatherData.current.windDirection}deg)` }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    {weatherData.current.windSpeed > 30 ? '💨 Kuvvetli esintili hava şartları.' : '🍃 Hafif ve tatlı meltem esintisi.'}
                  </div>
                </div>

                {/* 3. Humidity & Comfort */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-sm dark:shadow-lg backdrop-blur-md flex flex-col justify-between space-y-3 transition-colors">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Droplets size={16} className="text-blue-500 dark:text-blue-400" />
                      Nem Oranı
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {weatherData.current.relativeHumidity > 75 ? 'Nemli' : weatherData.current.relativeHumidity < 35 ? 'Kuru' : 'İdeal'}
                    </span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                      %{weatherData.current.relativeHumidity}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                      {weatherData.current.relativeHumidity > 70
                        ? 'Yüksek nem nedeniyle sıcaklık daha bunaltıcı hissedilebilir.'
                        : 'Nem dengesi nefes alma ve açık hava konforu için uygundur.'}
                    </p>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${weatherData.current.relativeHumidity}%` }}
                    />
                  </div>
                </div>

                {/* 4. Visibility */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-sm dark:shadow-lg backdrop-blur-md flex flex-col justify-between space-y-3 transition-colors">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Eye size={16} className="text-indigo-500 dark:text-indigo-400" />
                      Görüş Mesafesi
                    </span>
                    <span className="text-slate-700 dark:text-white font-bold">
                      {weatherData.hourly[0]?.visibility >= 10 ? 'Mükemmel' : 'Orta'}
                    </span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                      {weatherData.hourly[0]?.visibility || 10} <span className="text-xs font-bold text-slate-400">km</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                      {weatherData.hourly[0]?.visibility >= 10
                        ? 'Görüş açısı tamamen berrak ve açık.'
                        : 'Hafif pus veya sis görüş mesafesini sınırlayabilir.'}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-400">Karayolu ve deniz ulaşımı için elverişli.</div>
                </div>

                {/* 5. Surface Pressure */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-sm dark:shadow-lg backdrop-blur-md flex flex-col justify-between space-y-3 transition-colors">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Gauge size={16} className="text-teal-600 dark:text-teal-400" />
                      Hava Basıncı
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      {weatherData.current.surfacePressure >= 1013 ? 'Yüksek' : 'Alçak'}
                    </span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                      {weatherData.current.surfacePressure} <span className="text-xs font-bold text-slate-400">hPa</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                      {weatherData.current.surfacePressure >= 1013
                        ? 'Kararlı ve sakin yüksek atmosfer basıncı.'
                        : 'Alçak basınç sistemi, bulut ve yağış geçişleri getirebilir.'}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-400">Standart deniz seviyesi: 1013 hPa</div>
                </div>

                {/* 6. Sunrise & Sunset */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-sm dark:shadow-lg backdrop-blur-md flex flex-col justify-between space-y-3 transition-colors">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Sunrise size={16} className="text-amber-500" />
                      Gün Döngüsü
                    </span>
                    <span className="text-slate-700 dark:text-white font-bold">Gündüz / Gece</span>
                  </div>

                  <div className="flex items-center justify-around py-1">
                    <div className="flex flex-col items-center">
                      <Sunrise size={22} className="text-amber-500 mb-1" />
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Gün Doğumu</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">{weatherData.daily[0]?.sunrise}</span>
                    </div>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />

                    <div className="flex flex-col items-center">
                      <Sunset size={22} className="text-rose-500 mb-1" />
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Gün Batımı</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">{weatherData.daily[0]?.sunset}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 text-center">
                    Günün ışık süresi: ~13 saat 40 dakika
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      {/* ====================================================================== */}
      {/* 3. 7-DAY FORECAST DAY DETAIL POP-UP MODAL */}
      {/* ====================================================================== */}
      {selectedDay && (
        <div
          onClick={() => setSelectedDay(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto shadow-2xl space-y-6 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 transition-all"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 shadow-xs">
                  <WeatherIcon code={selectedDay.weatherCode} size={36} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    {selectedDay.dayLabel} — Günlük Hava Raporu
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span>{new Date(selectedDay.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span>•</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {getWeatherMeta(selectedDay.weatherCode).label}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Kapat (ESC)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Summary Grid (2x2) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Temp Max/Min */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Thermometer size={12} className="text-rose-500" /> Sıcaklık
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {selectedDay.temperatureMax}° / {selectedDay.temperatureMin}°
                </div>
                <div className="text-[10px] text-slate-500">
                  Hissedilen: {selectedDay.apparentTemperatureMax}° / {selectedDay.apparentTemperatureMin}°
                </div>
              </div>

              {/* Rain Chance & Sum */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Umbrella size={12} className="text-sky-500" /> Yağış Durumu
                </span>
                <div className="text-base sm:text-lg font-black text-sky-600 dark:text-sky-400">
                  %{selectedDay.precipitationProbabilityMax}
                </div>
                <div className="text-[10px] text-slate-500">
                  Beklenen: {selectedDay.precipitationSum > 0 ? `${selectedDay.precipitationSum} mm` : 'Yağış yok'}
                </div>
              </div>

              {/* Wind & UV */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Wind size={12} className="text-teal-500" /> Rüzgar & UV
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {selectedDay.windSpeedMax} <span className="text-xs font-normal text-slate-400">km/s</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Maks UV: {selectedDay.uvIndexMax} ({getUVLevelText(selectedDay.uvIndexMax).text})
                </div>
              </div>

              {/* Sun Times */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sunrise size={12} className="text-amber-500" /> Güneş Döngüsü
                </span>
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-1">
                  🌅 {selectedDay.sunrise}
                </div>
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  🌇 {selectedDay.sunset}
                </div>
              </div>
            </div>

            {/* 24-Hour Timeline For Selected Day */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-500" />
                  {selectedDay.dayLabel} Günlük 24 Saatlik Çizelge
                </span>
                <span className="text-[10px] text-slate-400">Yana kaydırın →</span>
              </div>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 no-scrollbar touch-pan-x">
                {selectedDayHourlyList.map((h, hIdx) => (
                  <div
                    key={`modal-hour-${hIdx}`}
                    className="flex flex-col items-center justify-between min-w-[72px] sm:min-w-[76px] p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 shrink-0 text-center"
                  >
                    <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">
                      {h.hourLabel}
                    </span>

                    <div className="my-2">
                      <WeatherIcon code={h.weatherCode} isDay={h.isDay} size={22} />
                    </div>

                    <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                      {h.temperature}°
                    </span>

                    {/* Rain probability and mm amount */}
                    <div className="mt-1 flex flex-col items-center">
                      {h.precipitationProbability > 0 ? (
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                          <Droplets size={9} />
                          %{h.precipitationProbability}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">-</span>
                      )}

                      {h.precipitation > 0 && (
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                          {h.precipitation} mm
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedDay(null)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
