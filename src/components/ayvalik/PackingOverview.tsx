import { useEffect, useState } from 'react';
import { DEFAULT_PACKING_ITEMS } from '../../utils/ayvalikPacking';
import { getApiUrl, getAuthHeaders } from '../../utils/api';

type Entry = { id: number; username: string; item_id: string; is_checked: number; updated_at: string };

export default function PackingOverview() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState('Hazırlık durumu yükleniyor…');
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch(getApiUrl('/api/ayvalik/checklist/overview'), { headers: getAuthHeaders(), signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!abort.signal.aborted) { setEntries(data.entries); setStatus(''); }
      }).catch(() => { if (!abort.signal.aborted) setStatus('Çanta özeti alınamadı.'); });
    return () => abort.abort();
  }, [revision]);

  const people = new Map<number, Entry[]>();
  for (const entry of entries) {
    const items = people.get(entry.id) ?? [];
    items.push(entry);
    people.set(entry.id, items);
  }
  return <section className="space-y-3 rounded-2xl border p-5 dark:border-slate-700">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-black">Grubun çanta hazırlığı</h2><button className="rounded-lg border px-3 py-2" onClick={() => refresh(value => value + 1)}>Yenile</button></div>
    <p className="text-sm">Listeye işlem yapan {people.size} kişi. Ayrıntıları açarak hazır ve eksik maddeleri görebilirsin.</p>
    {status && <p role="status">{status}</p>}
    {[...people.entries()].map(([id, items]) => {
      const ready = new Set(items.filter(item => Number(item.is_checked) === 1).map(item => item.item_id));
      return <details key={id} className="rounded-xl border p-3">
        <summary className="cursor-pointer font-bold">{items[0].username} · {DEFAULT_PACKING_ITEMS.filter(item => ready.has(item.id)).length}/{DEFAULT_PACKING_ITEMS.length} hazır</summary>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{DEFAULT_PACKING_ITEMS.map(item => <li key={item.id}>{ready.has(item.id) ? '✓ Hazır' : '○ Eksik'} · {item.label}</li>)}</ul>
      </details>;
    })}
  </section>;
}
