import { useState } from 'react';
import { activityLabel } from '../../shared/germanActivities';
export default function ActivityInput({ task, value, onChange, disabled }: { task: any; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [selected, setSelected] = useState<number[]>(() => {
    const tokens = task.type === 'spelling' ? Array.from(value) : value ? value.split(' ') : [];
    const indices: number[] = [];
    for (const token of tokens) { const i = task.interaction?.tiles?.findIndex((v: string, j: number) => v === token && !indices.includes(j)); if (i >= 0) indices.push(i); }
    return indices;
  });
  const tiles: string[] | undefined = task.interaction?.tiles;
  let pairs: string[] = []; try { pairs = JSON.parse(value || '[]'); } catch { /* Legacy draft remains editable. */ }
  const multiple = value ? value.split(' | ') : [];
  const selectTiles = (next: number[]) => { setSelected(next); onChange(next.map(i => tiles![i]).join(task.type === 'spelling' ? '' : ' ')); };
  return <div className="kg-activity-input">
    <span className="kg-activity-badge">{activityLabel(task.type)}</span>
    {tiles ? <>
      <div className="kg-tile-answer" aria-label="Oluşturduğun yanıt" aria-live="polite">
        {selected.length ? selected.map((i, j) => <button disabled={disabled} key={i} aria-label={`${tiles[i] === ' ' ? 'Boşluk' : tiles[i]} taşını kaldır`} onClick={() => selectTiles(selected.filter((_, n) => n !== j))}>{tiles[i] === ' ' ? '␣' : tiles[i]}</button>) : <span>Taşlara dokunarak yanıtını oluştur</span>}
      </div>
      <div className="kg-tiles">{tiles.map((tile, i) => <button key={i} disabled={disabled || selected.includes(i)} onClick={() => selectTiles([...selected, i])}>{tile === ' ' ? '␣' : tile}</button>)}</div>
      <button disabled={disabled} onClick={() => selectTiles([])}>Temizle</button>
    </> : task.type === 'matching' ? <div className="kg-pairs">{task.interaction.left.map((left: string, i: number) => <label key={i}><strong lang="de">{left}</strong><select disabled={disabled} aria-label={`${left} için eş seç`} value={pairs[i] || ''} onChange={e => { const next = [...pairs]; next[i] = e.target.value; onChange(JSON.stringify(next)); }}><option value="">Eşini seç</option>{task.interaction.right.map((r: string) => <option key={r} value={r}>{r}</option>)}</select></label>)}</div>
    : task.options?.length ? <div className="kg-options">{task.options.map((o: string, i: number) => <button disabled={disabled} key={o} aria-pressed={task.type === 'multi' ? multiple.includes(o) : value === o} onClick={() => onChange(task.type === 'multi' ? (multiple.includes(o) ? multiple.filter(v => v !== o) : [...multiple, o]).sort().join(' | ') : o)}><span className="kg-option-number">{i + 1}</span>{o}</button>)}</div>
    : <textarea aria-label="Yanıtın" rows={task.module === 'vocabulary' ? 3 : 8} maxLength={12000} value={value} disabled={disabled} placeholder="Yanıtını buraya yaz…" autoCapitalize="off" spellCheck={false} onChange={e => onChange(e.target.value)} />}
    <p className="kg-note">{tiles ? 'Sırayı değiştirmek için seçili taşa dokun. ␣ bir boşluktur.' : task.type === 'multi' ? 'Birden fazla doğru kart olabilir.' : 'Yanıtın otomatik kaydedilir. Hazır olduğunda kontrol et.'}</p>
  </div>;
}
