import React from 'react';
import {
  Sun,
  Moon,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
} from 'lucide-react';

interface WeatherIconProps {
  code: number;
  isDay?: boolean;
  className?: string;
  size?: number;
}

export default function WeatherIcon({ code, isDay = true, className = '', size = 24 }: WeatherIconProps) {
  // Clear Sky
  if (code === 0) {
    if (!isDay) {
      return <Moon size={size} className={`text-indigo-300 drop-shadow-sm ${className}`} />;
    }
    return <Sun size={size} className={`text-amber-400 drop-shadow-md animate-spin-slow ${className}`} />;
  }

  // Mainly Clear / Partly Cloudy
  if (code === 1 || code === 2) {
    if (!isDay) {
      return <Moon size={size} className={`text-indigo-300 ${className}`} />;
    }
    return <CloudSun size={size} className={`text-amber-300 ${className}`} />;
  }

  // Overcast / Cloudy
  if (code === 3) {
    return <Cloud size={size} className={`text-slate-300 dark:text-slate-400 ${className}`} />;
  }

  // Fog / Mist
  if (code === 45 || code === 48) {
    return <CloudFog size={size} className={`text-slate-400 dark:text-slate-500 ${className}`} />;
  }

  // Drizzle
  if (code >= 51 && code <= 57) {
    return <CloudDrizzle size={size} className={`text-sky-400 ${className}`} />;
  }

  // Rain
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain size={size} className={`text-blue-400 ${className}`} />;
  }

  // Snow
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return <CloudSnow size={size} className={`text-sky-200 ${className}`} />;
  }

  // Thunderstorm
  if (code >= 95) {
    return <CloudLightning size={size} className={`text-yellow-400 ${className}`} />;
  }

  // Default fallback
  return isDay ? (
    <Sun size={size} className={`text-amber-400 ${className}`} />
  ) : (
    <Moon size={size} className={`text-indigo-300 ${className}`} />
  );
}
