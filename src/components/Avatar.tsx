import React, { useState } from 'react';

interface AvatarProps {
  url?: string | null;
  name?: string;
  color?: string;
  size?: number; // Tailwind class equivalent size mapped (e.g. 10 -> w-10 h-10)
  className?: string;
}

export default function Avatar({ url, name, color, size = 10, className = "" }: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  if (url && url !== "null" && !hasError) {
    return (
      <img 
        src={url} 
        alt={name || "avatar"} 
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className={`rounded-full object-cover ${className}`} 
        style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }}
      />
    );
  }

  let initials = "?";
  if (name) {
    const cleanedWords = name
      .replace(/[()[\]{}]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (cleanedWords.length > 1) {
      initials = (cleanedWords[0][0] + cleanedWords[1][0]).toLocaleUpperCase("tr-TR");
    } else if (cleanedWords.length === 1) {
      initials = cleanedWords[0].substring(0, 2).toLocaleUpperCase("tr-TR");
    }
  }

  const bgColor = color || 'bg-slate-400';
  
  return (
    <div 
      className={`${bgColor.startsWith('bg-') ? bgColor : ''} text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{ 
        width: `${size * 0.25}rem`, 
        height: `${size * 0.25}rem`, 
        fontSize: `${Math.max(size * 0.1, 0.75)}rem`, 
        backgroundColor: bgColor.startsWith('#') ? bgColor : undefined 
      }}
    >
      {initials}
    </div>
  );
}
