import { useState } from 'react';
import emojis from '../shared/emojiData.json';

// Unicode Emoji 16.0, fully qualified sequences, bundled locally. See docs/DM_FIXES.md.
export default function DmEmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(160);
  const matches = emojis.filter(([emoji, name]) => `${emoji} ${name}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="fixed inset-0 z-[100] bg-black/30 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Emoji tepkisi" className="w-full max-w-sm max-h-[75dvh] overflow-y-auto rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-xl text-slate-900 dark:text-white" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="flex justify-between mb-3"><strong>Tepki ekle</strong><button type="button" onClick={onClose} aria-label="Kapat">✕</button></div>
      <div className="flex flex-wrap gap-1">{['❤️','😂','👍','😮','😢','🔥'].map(emoji => <button type="button" className="p-2 text-2xl" key={emoji} onClick={() => onSelect(emoji)}>{emoji}</button>)}</div>
      <button type="button" className="my-2 text-blue-500" onClick={() => setExpanded(!expanded)}>Tüm emojiler</button>
      {expanded && <><input autoFocus aria-label="Emoji ara" placeholder="Ara: smile, heart, flag… veya emoji yapıştır" value={query} onChange={e => { setQuery(e.target.value); setLimit(160); }} className="w-full border rounded-lg p-2 mb-3 bg-transparent" />
        <div className="grid grid-cols-6 gap-1">{matches.slice(0, limit).map(([emoji, name]) => <button type="button" title={name} aria-label={name} className="text-2xl p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded" key={emoji} onClick={() => onSelect(emoji)}>{emoji}</button>)}</div>
        {matches.length > limit && <button type="button" className="p-3 text-blue-500" onClick={() => setLimit(limit + 160)}>Daha fazla</button>}</>}
    </section>
  </div>;
}
