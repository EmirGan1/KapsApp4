import StrikeSkins from "./StrikeSkins";
import type { SkinId } from "../../../games/kapsstrike/skins";
import React, { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { CASES, COSMETICS, RARITIES, caseRewards, emptyInventory, type Cosmetic, type Inventory } from '../../../games/kapsstrike/cosmetics';
import { WEAPONS } from '../../../games/kapsstrike/config';

export function WeaponArt({ item }: { item: Cosmetic }) {
  const gradientId = 'finish-' + item.id;
  const finishFill = `url(#${gradientId})`;

  const renderWeaponSilhouette = () => {
    if (item.weapon === 'knife') {
      if (item.knife === 'karambit') {
        // Karambit: Curved talon blade, ergonomic finger groove handle, retention safety ring
        return (
          <g transform="translate(30, 20) rotate(-15 90 35)">
            {/* Safety Ring */}
            <circle cx="28" cy="45" r="14" fill="none" stroke={item.accent} strokeWidth="4" />
            <circle cx="28" cy="45" r="10" fill="#0f172a" />
            {/* Handle with finger grooves */}
            <path
              d="M 38 40 Q 55 35 75 37 Q 85 39 95 43 Q 88 52 75 51 Q 62 52 50 49 Q 38 52 38 40 Z"
              fill="#1e293b"
              stroke={item.accent}
              strokeWidth="2"
            />
            {/* Finger groove scallops */}
            <path d="M 52 49 Q 58 45 64 50 M 67 50 Q 73 45 80 50" stroke="#0f172a" strokeWidth="2" fill="none" />
            {/* Blade Talon / Hawkbill */}
            <path
              d="M 88 40 Q 115 30 145 28 Q 170 32 185 55 Q 160 50 135 48 Q 105 50 92 44 Z"
              fill={finishFill}
              stroke={item.accent}
              strokeWidth="2.5"
            />
            {/* Razor cutting edge inner bevel */}
            <path d="M 94 44 Q 130 48 185 55" stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.8" />
            {/* Spine jimping */}
            <path d="M 100 33 L 103 36 M 108 32 L 111 35 M 116 31 L 119 34" stroke={item.accent} strokeWidth="1.5" />
          </g>
        );
      } else if (item.knife === 'butterfly') {
        // Balisong: Dual skeletonized handles with speed holes, pivot pins, latch, clip-point blade
        return (
          <g transform="translate(15, 20) rotate(-8 105 35)">
            {/* Safe & Bite handles */}
            <g fill="#1e293b" stroke={item.accent} strokeWidth="2">
              {/* Upper Safe Handle */}
              <rect x="25" y="26" width="75" height="11" rx="4" />
              {/* Lower Bite Handle */}
              <rect x="25" y="41" width="75" height="11" rx="4" />
            </g>
            {/* Speed holes */}
            <g fill="#0f172a">
              <circle cx="42" cy="31.5" r="3" />
              <circle cx="58" cy="31.5" r="3" />
              <circle cx="74" cy="31.5" r="3" />
              <circle cx="42" cy="46.5" r="3" />
              <circle cx="58" cy="46.5" r="3" />
              <circle cx="74" cy="46.5" r="3" />
            </g>
            {/* Latch */}
            <path d="M 23 44 H 26 V 50 H 23 Z" fill="#64748b" />
            {/* Pivot pins */}
            <circle cx="94" cy="31.5" r="2.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1" />
            <circle cx="94" cy="46.5" r="2.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1" />
            {/* Tang & Blade */}
            <path
              d="M 96 36 L 108 36 L 140 35 L 180 34 L 195 40 L 165 44 L 115 44 L 96 42 Z"
              fill={finishFill}
              stroke={item.accent}
              strokeWidth="2.5"
            />
            {/* Swedge / false edge and cutting bevel */}
            <path d="M 155 35 L 195 40 L 110 44" stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.8" />
          </g>
        );
      } else {
        // Tanto / Combat Knife: Chisel tip, angular point, straight spine, habaki & wrap
        return (
          <g transform="translate(20, 20) rotate(-10 100 35)">
            {/* Tsuka handle */}
            <rect x="25" y="34" width="65" height="14" rx="2" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
            {/* Diamond wrap pattern */}
            <path d="M 35 34 L 45 48 M 45 34 L 55 48 M 55 34 L 65 48 M 65 34 L 75 48" stroke="#334155" strokeWidth="2" />
            {/* Tsuba guard */}
            <rect x="89" y="27" width="5" height="28" rx="2" fill="#475569" stroke={item.accent} strokeWidth="1.5" />
            {/* Habaki collar */}
            <rect x="94" y="34" width="7" height="14" fill="#d97706" />
            {/* Tanto Blade with angular chisel tip */}
            <path
              d="M 101 35 L 165 35 L 195 41 L 180 47 L 101 47 Z"
              fill={finishFill}
              stroke={item.accent}
              strokeWidth="2.5"
            />
            {/* Chisel yokote line */}
            <line x1="165" y1="35" x2="180" y2="47" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
            <line x1="101" y1="46" x2="180" y2="46" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
          </g>
        );
      }
    }

    if (item.weapon === 'sniper') {
      // Sniper / AWP: Long barrel, optical scope, bipod lug, thumbhole stock
      return (
        <g transform="translate(10, 15) rotate(-5 110 40)">
          {/* Thumbhole Stock & Body */}
          <path
            d="M 20 45 L 45 42 L 70 42 L 95 38 L 135 38 L 140 46 L 90 46 L 75 58 L 50 60 L 40 54 L 20 54 Z"
            fill={finishFill}
            stroke={item.accent}
            strokeWidth="2"
          />
          {/* Stock cutout */}
          <ellipse cx="48" cy="49" rx="8" ry="4" fill="#0f172a" />
          {/* Long Precision Barrel & Muzzle Brake */}
          <rect x="135" y="40" width="80" height="4.5" fill="#334155" stroke={item.accent} strokeWidth="1.5" />
          <rect x="212" y="38" width="10" height="8.5" rx="1.5" fill="#1e293b" stroke={item.accent} strokeWidth="1.5" />
          {/* Optical Scope Mounts & Scope Tube */}
          <rect x="85" y="32" width="6" height="6" fill="#475569" />
          <rect x="115" y="32" width="6" height="6" fill="#475569" />
          <rect x="75" y="24" width="55" height="9" rx="2" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
          {/* Scope Lenses */}
          <rect x="72" y="22" width="6" height="13" rx="2" fill="#64748b" stroke={item.accent} strokeWidth="1.5" />
          <rect x="127" y="23" width="7" height="11" rx="2" fill="#0284c7" stroke={item.accent} strokeWidth="1.5" />
          {/* Straight Bolt handle */}
          <path d="M 90 38 L 96 35 L 94 32" stroke="#e2e8f0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
    }

    if (item.weapon === 'pistol') {
      // Tactical Handgun: Heavy slide, slide serrations, trigger guard, tactical grip
      return (
        <g transform="translate(45, 10) rotate(-6 75 45)">
          {/* Slide */}
          <rect x="30" y="30" width="95" height="20" rx="3" fill={finishFill} stroke={item.accent} strokeWidth="2" />
          {/* Slide serrations */}
          <g stroke="#0f172a" strokeWidth="2">
            <line x1="36" y1="33" x2="36" y2="46" />
            <line x1="42" y1="33" x2="42" y2="46" />
            <line x1="48" y1="33" x2="48" y2="46" />
          </g>
          {/* Ejection port & barrel tip */}
          <rect x="72" y="30" width="18" height="7" fill="#0f172a" />
          <rect x="125" y="34" width="8" height="11" fill="#334155" />
          {/* Frame & Ergonomic Grip */}
          <path
            d="M 40 50 L 78 50 L 78 58 Q 72 63 60 63 L 56 78 L 35 76 L 40 50 Z"
            fill="#1e293b"
            stroke={item.accent}
            strokeWidth="2"
          />
          {/* Grip checkering */}
          <rect x="40" y="58" width="14" height="16" rx="2" fill="#0f172a" opacity="0.6" />
          {/* Trigger Guard & Trigger */}
          <path d="M 60 50 Q 64 62 76 60" fill="none" stroke={item.accent} strokeWidth="2" />
          <path d="M 68 53 Q 66 57 70 58" fill="none" stroke="#e2e8f0" strokeWidth="2" />
        </g>
      );
    }

    if (item.weapon === 'smg') {
      // SMG (Submachine gun): Compact body, curved stick mag, barrel shroud, folding stock
      return (
        <g transform="translate(20, 15) rotate(-6 100 40)">
          {/* Wire stock */}
          <path d="M 25 45 L 55 45 L 60 48" fill="none" stroke="#64748b" strokeWidth="3" />
          {/* Receiver */}
          <rect x="55" y="34" width="70" height="18" rx="2" fill={finishFill} stroke={item.accent} strokeWidth="2" />
          {/* Handguard & Shroud */}
          <rect x="125" y="37" width="30" height="13" rx="2" fill="#1e293b" stroke={item.accent} strokeWidth="1.5" />
          <circle cx="132" cy="43.5" r="2" fill="#0f172a" />
          <circle cx="140" cy="43.5" r="2" fill="#0f172a" />
          <circle cx="148" cy="43.5" r="2" fill="#0f172a" />
          {/* Barrel & Flash Hider */}
          <rect x="155" y="41" width="16" height="5" fill="#334155" stroke={item.accent} strokeWidth="1.5" />
          {/* Pistol Grip */}
          <path d="M 65 52 L 58 72 L 48 70 L 58 52 Z" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
          {/* Curved SMG Magazine */}
          <path d="M 100 52 Q 106 65 116 75 L 106 78 Q 96 66 90 52 Z" fill="#334155" stroke={item.accent} strokeWidth="2" />
          {/* Sights */}
          <rect x="62" y="29" width="6" height="5" fill="#475569" />
          <circle cx="150" cy="33" r="3" fill="none" stroke="#475569" strokeWidth="1.5" />
        </g>
      );
    }

    if (item.weapon === 'shotgun') {
      // Pump Action Shotgun: Solid stock, receiver, magazine tube, ribbed pump slide, thick barrel
      return (
        <g transform="translate(15, 15) rotate(-6 105 40)">
          {/* Fixed Wood/Polymer Stock */}
          <path d="M 25 54 L 55 45 L 80 43 L 80 54 L 45 62 Z" fill="#475569" stroke={item.accent} strokeWidth="2" />
          {/* Receiver */}
          <rect x="80" y="38" width="45" height="17" rx="2" fill={finishFill} stroke={item.accent} strokeWidth="2" />
          {/* Ejection port */}
          <rect x="92" y="41" width="18" height="6" fill="#0f172a" />
          {/* Long Shotgun Barrel & Magazine Tube */}
          <rect x="125" y="39" width="85" height="7" fill={finishFill} stroke={item.accent} strokeWidth="1.5" />
          <rect x="125" y="47" width="70" height="5.5" fill="#334155" stroke={item.accent} strokeWidth="1.5" />
          {/* Pump Slide with Ribs */}
          <rect x="138" y="44" width="28" height="11" rx="2" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
          <line x1="144" y1="45" x2="144" y2="54" stroke="#475569" strokeWidth="2" />
          <line x1="150" y1="45" x2="150" y2="54" stroke="#475569" strokeWidth="2" />
          <line x1="156" y1="45" x2="156" y2="54" stroke="#475569" strokeWidth="2" />
          {/* Trigger Guard */}
          <path d="M 75 54 Q 78 63 87 61" fill="none" stroke={item.accent} strokeWidth="2" />
        </g>
      );
    }

    if (item.weapon === 'carbine') {
      // Carbine / M4A1: Quad rail handguard, flat top receiver, collapsible stock, STANAG mag
      return (
        <g transform="translate(15, 15) rotate(-6 105 40)">
          {/* Collapsible Stock & Buffer Tube */}
          <rect x="25" y="42" width="30" height="5" fill="#334155" />
          <path d="M 20 38 L 40 40 L 35 56 L 20 54 Z" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
          {/* Receiver & Picatinny Rail */}
          <rect x="55" y="36" width="48" height="17" rx="2" fill={finishFill} stroke={item.accent} strokeWidth="2" />
          <rect x="55" y="33" width="75" height="3" fill="#334155" />
          {/* Quad Rail Handguard */}
          <rect x="103" y="37" width="45" height="13" rx="1.5" fill="#1e293b" stroke={item.accent} strokeWidth="1.5" />
          {/* Barrel & Birdcage Flash Hider */}
          <rect x="148" y="41" width="35" height="5" fill="#334155" stroke={item.accent} strokeWidth="1.5" />
          <rect x="180" y="39.5" width="8" height="8" fill="#1e293b" stroke={item.accent} strokeWidth="1.5" />
          {/* Tactical Grip */}
          <path d="M 68 53 L 62 72 L 52 70 L 60 53 Z" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
          {/* STANAG Magazine */}
          <path d="M 90 53 L 86 76 L 76 74 L 80 53 Z" fill="#334155" stroke={item.accent} strokeWidth="2" />
          {/* Red Dot / Optic */}
          <rect x="74" y="27" width="22" height="7" rx="2" fill="#0f172a" stroke={item.accent} strokeWidth="1.5" />
        </g>
      );
    }

    if (item.weapon === 'lmg') {
      // Heavy Machine Gun: Carry handle, heavy ribbed barrel, drum/box mag
      return (
        <g transform="translate(15, 15) rotate(-5 105 40)">
          {/* Heavy Stock */}
          <path d="M 20 42 L 50 42 L 55 58 L 20 56 Z" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
          {/* Heavy Receiver */}
          <rect x="50" y="34" width="65" height="20" rx="3" fill={finishFill} stroke={item.accent} strokeWidth="2" />
          {/* Carry Handle */}
          <path d="M 75 34 L 80 24 H 105 L 100 34" fill="none" stroke={item.accent} strokeWidth="2.5" />
          {/* Heavy Fluted Barrel & Bipod Mount */}
          <rect x="115" y="39" width="70" height="9" fill="#334155" stroke={item.accent} strokeWidth="2" />
          <rect x="182" y="37" width="10" height="13" fill="#1e293b" stroke={item.accent} strokeWidth="1.5" />
          <line x1="165" y1="48" x2="175" y2="65" stroke="#64748b" strokeWidth="2.5" />
          {/* Ammo Drum / Box Container */}
          <rect x="72" y="54" width="30" height="22" rx="4" fill={finishFill} stroke={item.accent} strokeWidth="2" />
          {/* Grip */}
          <path d="M 58 54 L 52 73 L 42 70 L 50 54 Z" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
        </g>
      );
    }

    if (item.weapon === 'railgun') {
      // Futuristic Railgun: Dual parallel prongs, plasma power core, energy conduit
      return (
        <g transform="translate(15, 15) rotate(-6 105 40)">
          {/* Sci-Fi Stock & Chassis */}
          <path d="M 20 40 L 60 38 L 75 42 L 65 60 L 25 58 Z" fill="#0f172a" stroke={item.accent} strokeWidth="2" />
          {/* Central Reactor Housing */}
          <rect x="65" y="34" width="50" height="20" rx="4" fill={finishFill} stroke={item.accent} strokeWidth="2" />
          {/* Glowing Plasma Core */}
          <circle cx="90" cy="44" r="7" fill={item.accent} opacity="0.85" />
          <circle cx="90" cy="44" r="4" fill="#ffffff" />
          {/* Dual Parallel Acceleration Rails */}
          <rect x="115" y="34" width="80" height="5" rx="1.5" fill="#334155" stroke={item.accent} strokeWidth="1.5" />
          <rect x="115" y="48" width="80" height="5" rx="1.5" fill="#334155" stroke={item.accent} strokeWidth="1.5" />
          {/* Electromagnetic coil bands */}
          <line x1="135" y1="34" x2="135" y2="53" stroke={item.accent} strokeWidth="2.5" opacity="0.75" />
          <line x1="155" y1="34" x2="155" y2="53" stroke={item.accent} strokeWidth="2.5" opacity="0.75" />
          <line x1="175" y1="34" x2="175" y2="53" stroke={item.accent} strokeWidth="2.5" opacity="0.75" />
        </g>
      );
    }

    // Default: Assault Rifle (AK-47 / AR-30 style)
    return (
      <g transform="translate(15, 15) rotate(-8 105 40)">
        {/* Rifle Stock */}
        <path d="M 25 50 L 55 42 L 75 42 L 75 52 L 40 58 Z" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
        {/* Receiver */}
        <rect x="75" y="36" width="55" height="16" rx="2" fill={finishFill} stroke={item.accent} strokeWidth="2" />
        {/* Wooden / Polymer Handguard */}
        <rect x="130" y="38" width="38" height="12" rx="2" fill={finishFill} stroke={item.accent} strokeWidth="2" />
        {/* Gas Tube & Long Barrel */}
        <rect x="130" y="34" width="35" height="4" fill="#334155" />
        <rect x="168" y="39" width="32" height="5" fill="#334155" stroke={item.accent} strokeWidth="1.5" />
        {/* Front Sight Post & Muzzle Slant Brake */}
        <path d="M 192 39 L 194 32 L 196 39 Z" fill="#1e293b" stroke={item.accent} strokeWidth="1.5" />
        <rect x="198" y="38" width="6" height="7" fill="#1e293b" />
        {/* Pistol Grip */}
        <path d="M 76 52 L 70 70 L 60 68 L 68 52 Z" fill="#1e293b" stroke={item.accent} strokeWidth="2" />
        {/* Banana Curved Magazine */}
        <path
          d="M 105 52 Q 112 68 122 80 L 110 83 Q 98 70 92 52 Z"
          fill={finishFill}
          stroke={item.accent}
          strokeWidth="2"
        />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 240 100" role="img" aria-label={item.name} className="w-full h-auto drop-shadow-md">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={item.color} />
          <stop offset="50%" stopColor={item.accent} />
          <stop offset="100%" stopColor={item.color} />
        </linearGradient>
      </defs>
      {renderWeaponSilhouette()}
    </svg>
  );
}

export default function StrikeInventory({
  socket,
  onChange,
  initialSkin,
  onSkin,
}: {
  socket?: Socket | null;
  onChange: (state: Inventory) => void;
  initialSkin?: SkinId;
  onSkin?: (skin: SkinId) => void;
}) {
  const [state, setState] = useState(emptyInventory);
  const [tab, setTab] = useState<'cases' | 'items' | 'characters'>('cases');
  const [selected, setSelected] = useState<string>(CASES[0].id);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<Cosmetic | null>(null);
  const [message, setMessage] = useState('');
  const [sound, setSound] = useState(true);
  const [pendingReward, setPendingReward] = useState<Cosmetic | null>(null);

  const audio = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!state.lastOpenedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.lastOpenedAt]);

  const cooling = now - (state.lastOpenedAt || 0) < 2500;

  const update = (s: Inventory) => {
    setState(s);
    onChange(s);
  };

  useEffect(() => {
    alive.current = true;
    if (socket?.connected) {
      setBusy(true);
      socket.timeout(6000).emit('strike:inventory_get', {}, (err: any, r: any) => {
        if (!alive.current) return;
        setBusy(false);
        if (!err && r?.success) update(r.state);
        else setMessage(r?.error || 'Envanter yüklenemedi.');
      });
    }
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (ticker.current) clearInterval(ticker.current);
      void audio.current?.close();
    };
  }, [socket]);

  const tick = (final = false) => {
    const a = audio.current;
    if (!a || !sound) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = final ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(final ? 740 : 220, a.currentTime);
    g.gain.setValueAtTime(0.045, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + (final ? 0.4 : 0.035));
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + (final ? 0.45 : 0.04));
  };

  const open = () => {
    if (busy || !socket?.connected) return;
    setBusy(true);
    setReward(null);
    setMessage('Sunucu ödülü belirliyor…');

    if (sound) {
      try {
        audio.current ||= new AudioContext();
        void audio.current.resume();
      } catch {}
    }

    socket.timeout(8000).emit('strike:inventory_open', { caseId: selected }, (err: any, r: any) => {
      if (!alive.current) return;
      if (err || !r?.success) {
        setBusy(false);
        setMessage(r?.error || 'Yanıt alınamadı. Envanteri yeniden açarak kontrol et.');
        return;
      }
      update(r.state);
      setPendingReward(r.item);
      setSpinning(true);
      setMessage('Kasa açılıyor…');
      ticker.current = setInterval(() => tick(), 110);
      timer.current = setTimeout(() => {
        if (ticker.current) clearInterval(ticker.current);
        setSpinning(false);
        setReward(r.item);
        tick(true);
        setBusy(false);
        setMessage('Görünüm hesabındaki envantere eklendi.');
      }, 2800);
    });
  };

  const equip = (item: Cosmetic) => {
    if (busy || !socket?.connected) return;
    setBusy(true);
    socket.timeout(6000).emit('strike:inventory_equip', { itemId: item.id }, (err: any, r: any) => {
      if (!alive.current) return;
      setBusy(false);
      if (!err && r?.success) {
        update(r.state);
        setMessage('Görünüm kuşanıldı.');
      } else setMessage(r?.error || 'Kuşanma başarısız.');
    });
  };

  const pool = caseRewards(selected);

  return (
    <div className="ks-inventory">
      <header>
        <h2>Envanter ve Kasalar</h2>
        <p>Tamamen kozmetik · Hasar ve hitbox değişmez · Ücretsiz açılış</p>
      </header>

      <nav className="ks-inv-tabs">
        <button aria-pressed={tab === 'cases'} onClick={() => setTab('cases')}>
          Kasalar
        </button>
        <button aria-pressed={tab === 'items'} onClick={() => setTab('items')}>
          Envanterim ({Object.keys(state.owned).length})
        </button>
        <button aria-pressed={tab === 'characters'} onClick={() => setTab('characters')}>
          Karakterler
        </button>
        <button aria-pressed={sound} onClick={() => setSound(!sound)}>
          Ses {sound ? 'açık' : 'kapalı'}
        </button>
      </nav>

      {tab === 'characters' ? (
        <StrikeSkins socket={socket} initialSkin={initialSkin} onSaved={onSkin} />
      ) : tab === 'cases' ? (
        <>
          <div className="ks-case-grid">
            {CASES.map((c) => (
              <button
                key={c.id}
                disabled={busy}
                aria-pressed={c.id === selected}
                onClick={() => {
                  setSelected(c.id);
                  setReward(null);
                }}
                style={{ '--rarity': c.color } as React.CSSProperties}
              >
                <span className="ks-case-icon">◇</span>
                <b>{c.name}</b>
                <small>%5 özel bıçak</small>
              </button>
            ))}
          </div>

          <div className={'ks-case-stage ' + (spinning ? 'is-spinning' : '')} aria-busy={busy}>
            {spinning ? (
              <>
                <div className="ks-case-needle" />
                <div className="ks-case-reel">
                  {Array.from({ length: 36 }, (_, i) => ({
                    item: i === 28 && pendingReward ? pendingReward : pool[i % pool.length].item,
                  })).map((r, i) => (
                    <div key={i} style={{ borderColor: RARITIES[r.item.rarity].color }}>
                      <WeaponArt item={r.item} />
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mt-1">
                        {WEAPONS[r.item.weapon]?.name || r.item.weapon}
                      </span>
                      <small>{r.item.name}</small>
                    </div>
                  ))}
                </div>
              </>
            ) : reward ? (
              <div
                className="ks-case-result"
                style={{ '--rarity': RARITIES[reward.rarity].color } as React.CSSProperties}
              >
                <strong>{RARITIES[reward.rarity].name}</strong>
                <WeaponArt item={reward} />
                <h3>{reward.name}</h3>
                <span className="font-semibold text-amber-300">
                  {WEAPONS[reward.weapon]?.name || reward.weapon}
                  {reward.knife ? ` (${reward.knife.toUpperCase()})` : ''}
                </span>
                <button disabled={busy} onClick={() => equip(reward)}>
                  Kuşan
                </button>
              </div>
            ) : (
              <p>Kasayı seç, içerikleri ve kesin olasılıkları incele.</p>
            )}
          </div>

          <button
            className="ks-primary ks-open-case"
            disabled={busy || cooling || !socket?.connected}
            onClick={open}
          >
            {busy ? 'Açılıyor…' : 'Kasayı ücretsiz aç'}
          </button>
          <p className="ks-case-disclosure">
            Her açılış bağımsızdır. Bıçak toplam %5; belirli bir bıçağın şansı %1,667. Tekrar çıkan görünümler
            adediyle saklanır. Takas veya parasal değer yoktur.
          </p>

          <h3>İçerikler ve olasılıklar</h3>
          <div className="ks-loot-grid">
            {pool.map(({ item, chance }) => (
              <article key={item.id} style={{ '--rarity': RARITIES[item.rarity].color } as React.CSSProperties}>
                <WeaponArt item={item} />
                <b>{item.name}</b>
                <small className="flex items-center justify-between text-xs text-slate-300 mt-1">
                  <span>{WEAPONS[item.weapon]?.name || item.weapon}</span>
                  <span style={{ color: RARITIES[item.rarity].color }}>{RARITIES[item.rarity].name}</span>
                </small>
                <strong>%{chance.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}</strong>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <p>Karakter kostümünü ana menüdeki Karakter / Skin bölümünden değiştirebilirsin.</p>
          <div className="ks-loot-grid">
            {COSMETICS.filter((c) => state.owned[c.id]).map((item) => (
              <article key={item.id} style={{ '--rarity': RARITIES[item.rarity].color } as React.CSSProperties}>
                <WeaponArt item={item} />
                <b>{item.name}</b>
                <small className="flex items-center justify-between text-xs text-slate-300 mt-1">
                  <span>
                    {WEAPONS[item.weapon]?.name || item.weapon}
                    {item.knife ? ` · ${item.knife}` : ''}
                  </span>
                  <span>×{state.owned[item.id]}</span>
                </small>
                <button
                  disabled={busy || state.equipped[item.weapon] === item.id}
                  onClick={() => equip(item)}
                >
                  {state.equipped[item.weapon] === item.id ? 'Kuşanıldı' : 'Kuşan'}
                </button>
              </article>
            ))}
          </div>
          {!Object.keys(state.owned).length && <p>Henüz kaplaman yok. İlk kasanı ücretsiz aç.</p>}
        </>
      )}

      <p role="status">{message}</p>
    </div>
  );
}
