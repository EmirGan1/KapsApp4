import React, { useEffect, useState, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { COSMETICS, RARITIES, type Cosmetic, type Inventory } from '../../../games/kapsstrike/cosmetics';
import { WEAPONS } from '../../../games/kapsstrike/config';
import type { WeaponId } from '../../../games/kapsstrike/types';

interface AdminUser {
  id: number;
  username: string;
  inventory: Inventory;
}

const CATEGORIES: { id: string; label: string; weapons?: WeaponId[] }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'knife', label: 'Bıçaklar', weapons: ['knife'] },
  { id: 'rifle', label: 'Tüfekler', weapons: ['rifle', 'carbine'] },
  { id: 'pistol', label: 'Tabancalar', weapons: ['pistol'] },
  { id: 'smg', label: 'Hafif Makineli (SMG)', weapons: ['smg'] },
  { id: 'sniper', label: 'Keskin Nişancı', weapons: ['sniper', 'railgun'] },
  { id: 'heavy', label: 'Ağır & Pompalı', weapons: ['shotgun', 'lmg'] },
];

export default function StrikeInventoryAdmin({ socket }: { socket?: Socket | null }) {
  const [allowed, setAllowed] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'success' | 'error'>('info');

  // Filter state for skin list
  const [skinSearch, setSkinSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'unowned'>('all');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket?.connected) return;
    socket.timeout(5000).emit('strike:inventory_admin_check', (e: any, r: any) => {
      setAllowed(!e && r?.success && r.allowed === true);
    });
  }, [socket]);

  const notify = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setMessage(text);
    setMsgType(type);
  };

  const search = () => {
    if (!allowed || !socket?.connected || busy) return;
    setBusy(true);
    socket.timeout(8000).emit('strike:inventory_admin_search', { query }, (e: any, r: any) => {
      setBusy(false);
      if (e || !r?.success) {
        notify(r?.error || 'Arama başarısız.', 'error');
        return;
      }
      setUsers(r.users);
      setSelectedId(r.users.length === 1 ? r.users[0].id : null);
      setSelectedItemIds(new Set());
      notify(`${r.users.length} hesap bulundu.`, 'success');
    });
  };

  const activeUser = users.find((u) => u.id === selectedId);

  // Filter cosmetics for active user
  const filteredCosmetics = useMemo(() => {
    if (!activeUser) return [];
    return COSMETICS.filter((c) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const cat = CATEGORIES.find((cat) => cat.id === selectedCategory);
        if (cat?.weapons && !cat.weapons.includes(c.weapon)) return false;
      }
      // Ownership filter
      const count = activeUser.inventory.owned[c.id] || 0;
      if (ownershipFilter === 'owned' && count <= 0) return false;
      if (ownershipFilter === 'unowned' && count > 0) return false;
      // Search query
      if (skinSearch.trim()) {
        const q = skinSearch.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesWeapon = WEAPONS[c.weapon]?.name?.toLowerCase().includes(q) || c.weapon.includes(q);
        const matchesRarity = RARITIES[c.rarity]?.name?.toLowerCase().includes(q);
        const matchesKnife = c.knife?.toLowerCase().includes(q);
        if (!matchesName && !matchesWeapon && !matchesRarity && !matchesKnife) return false;
      }
      return true;
    });
  }, [activeUser, selectedCategory, ownershipFilter, skinSearch]);

  // Grant single item
  const grantSingle = (itemId: string) => {
    if (!allowed || !socket?.connected || busy || !activeUser) return;
    setBusy(true);
    socket.timeout(8000).emit(
      'strike:inventory_admin_grant_item',
      { userId: activeUser.id, itemId },
      (e: any, r: any) => {
        setBusy(false);
        if (e || !r?.success) {
          notify(r?.error || 'Görünüm eklenemedi.', 'error');
          return;
        }
        setUsers((prev) => prev.map((u) => (u.id === activeUser.id ? r.user : u)));
        const item = COSMETICS.find((c) => c.id === itemId);
        notify(`@${activeUser.username} hesabına "${item?.name || itemId}" eklendi.`, 'success');
      }
    );
  };

  // Revoke single item
  const revokeSingle = (itemId: string) => {
    if (!allowed || !socket?.connected || busy || !activeUser) return;
    setBusy(true);
    socket.timeout(8000).emit(
      'strike:inventory_admin_revoke_item',
      { userId: activeUser.id, itemId },
      (e: any, r: any) => {
        setBusy(false);
        if (e || !r?.success) {
          notify(r?.error || 'Görünüm kaldırılamadı.', 'error');
          return;
        }
        setUsers((prev) => prev.map((u) => (u.id === activeUser.id ? r.user : u)));
        const item = COSMETICS.find((c) => c.id === itemId);
        notify(`@${activeUser.username} hesabından "${item?.name || itemId}" 1 adet kaldırıldı.`, 'info');
      }
    );
  };

  // Grant batch selected
  const grantSelected = () => {
    if (!allowed || !socket?.connected || busy || !activeUser || selectedItemIds.size === 0) return;
    const itemIds = Array.from(selectedItemIds);
    setBusy(true);
    socket.timeout(10000).emit(
      'strike:inventory_admin_grant_batch',
      { userId: activeUser.id, itemIds },
      (e: any, r: any) => {
        setBusy(false);
        if (e || !r?.success) {
          notify(r?.error || 'Toplu ekleme başarısız.', 'error');
          return;
        }
        setUsers((prev) => prev.map((u) => (u.id === activeUser.id ? r.user : u)));
        setSelectedItemIds(new Set());
        notify(`@${activeUser.username} hesabına seçilen ${r.count || itemIds.length} görünüm başarıyla eklendi.`, 'success');
      }
    );
  };

  // Grant all skins
  const grantAll = () => {
    if (!allowed || !socket?.connected || busy || !activeUser) return;
    const confirm = window.confirm(`@${activeUser.username} hesabına TÜM silah ve bıçak kaplamaları eklensin mi?`);
    if (!confirm) return;
    setBusy(true);
    socket.timeout(12000).emit('strike:inventory_admin_grant_all', { userId: activeUser.id }, (e: any, r: any) => {
      setBusy(false);
      if (e || !r?.success) {
        notify(r?.error || 'Görünümler eklenemedi.', 'error');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === activeUser.id ? r.user : u)));
      notify(`@${activeUser.username} hesabına tüm kozmetikler başarıyla eklendi.`, 'success');
    });
  };

  const toggleSelect = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedItemIds(new Set(filteredCosmetics.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedItemIds(new Set());
  };

  if (!allowed) {
    return (
      <section className="ks-inventory">
        <h2>Yönetici Envanteri</h2>
        <p role="status">Bu panel yalnızca doğrulanmış 'emirgan' yönetici hesabına açıktır.</p>
      </section>
    );
  }

  return (
    <section className="ks-inventory ks-inventory-admin">
      <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 pb-3 mb-4">
        <div>
          <h2 className="text-xl font-black text-amber-400 m-0">Emirgan · Envanter ve Skin Yönetimi</h2>
          <p className="text-xs text-slate-400 m-0 mt-1">
            Tek tek skin verme, toplu seçim, kategori filtreleme ve geri alma kontrolleri.
          </p>
        </div>
        <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
          Admin Yetkili
        </span>
      </div>

      {/* User Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={query}
          maxLength={40}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kullanıcı adı veya ara…"
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={busy || !socket?.connected}
          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {busy ? 'Aranıyor…' : 'Ara'}
        </button>
      </form>

      {/* Status Alert */}
      {message && (
        <div
          role="status"
          className={`p-2.5 rounded-lg text-xs font-semibold mb-4 border ${
            msgType === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40'
              : msgType === 'error'
              ? 'bg-rose-950/60 text-rose-300 border-rose-600/40'
              : 'bg-sky-950/60 text-sky-300 border-sky-600/40'
          }`}
        >
          {message}
        </div>
      )}

      {/* User Selection List */}
      <div className="ks-admin-user-list flex flex-wrap gap-2 mb-5">
        {users.map((u) => {
          const ownedTotal = Object.values(u.inventory.owned).reduce((n, c) => n + c, 0);
          const isCurrent = selectedId === u.id;
          return (
            <button
              key={u.id}
              type="button"
              aria-pressed={isCurrent}
              onClick={() => {
                setSelectedId(u.id);
                setSelectedItemIds(new Set());
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                isCurrent
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700/70'
              }`}
            >
              <span className="font-bold">@{u.username}</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900/80 text-slate-400 border border-slate-700/50">
                {ownedTotal} skin · {u.inventory.opened} kasa
              </span>
            </button>
          );
        })}
      </div>

      {/* Active User Workspace */}
      {activeUser && (
        <article className="ks-admin-target bg-slate-900/80 border border-slate-700/80 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-100 m-0">
                @{activeUser.username} — Envanter Yönetimi
              </h3>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Toplam Sahip Olunan:{' '}
                <strong className="text-amber-300">
                  {Object.values(activeUser.inventory.owned).reduce((n, c) => n + c, 0)} adet
                </strong>{' '}
                · Kasa Açılışı: <strong>{activeUser.inventory.opened}</strong>
              </p>
            </div>

            {/* Batch Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectedItemIds.size > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={grantSelected}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs transition-colors"
                >
                  ✓ Seçilenleri Ver ({selectedItemIds.size})
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={grantAll}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs transition-colors"
              >
                ⚡ Tümünü Ekle (Toplu)
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
            <input
              type="text"
              value={skinSearch}
              onChange={(e) => setSkinSearch(e.target.value)}
              placeholder="Skin veya silah adı filtrele…"
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="all">Sahiplik: Tümü</option>
              <option value="owned">Yalnızca Sahip Olunanlar</option>
              <option value="unowned">Yalnızca Sahip Olunmayanlar</option>
            </select>
          </div>

          {/* Multi-select Helpers */}
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
            <span>
              Listelenen: <strong>{filteredCosmetics.length}</strong> görünüm
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-amber-400 hover:underline text-xs"
              >
                Görünenlerin Tümünü Seç
              </button>
              {selectedItemIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  Seçimi Temizle
                </button>
              )}
            </div>
          </div>

          {/* Granular Skin Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredCosmetics.map((c) => {
              const ownedCount = activeUser.inventory.owned[c.id] || 0;
              const isSelected = selectedItemIds.has(c.id);
              const rarityInfo = RARITIES[c.rarity];
              const weaponName = WEAPONS[c.weapon]?.name || c.weapon;

              return (
                <article
                  key={c.id}
                  style={{ borderColor: isSelected ? '#fbbf24' : rarityInfo.color + '55' }}
                  className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between ${
                    isSelected ? 'bg-amber-950/30' : 'bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded border-slate-600 text-amber-500 focus:ring-0"
                      />
                      <div className="truncate">
                        <strong className="block text-xs text-slate-100 truncate" title={c.name}>
                          {c.name}
                        </strong>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {weaponName} · {rarityInfo.name}
                        </span>
                      </div>
                    </label>
                    {ownedCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 shrink-0">
                        ×{ownedCount}
                      </span>
                    )}
                  </div>

                  {/* Individual Actions */}
                  <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-slate-700/40">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => grantSingle(c.id)}
                      title="Kullanıcıya bu görünümden 1 adet ekle"
                      className="flex-1 py-1 px-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="text-emerald-400 font-bold">+</span> Ekle
                    </button>
                    {ownedCount > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => revokeSingle(c.id)}
                        title="Kullanıcıdan bu görünümden 1 adet çıkar"
                        className="py-1 px-2 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 text-[11px] font-semibold transition-colors"
                      >
                        Kaldır
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      )}
    </section>
  );
}
