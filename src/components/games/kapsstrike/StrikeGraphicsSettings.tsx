import React from 'react';
import type {StrikeSettings} from '../../../games/kapsstrike/types';
export default function StrikeGraphicsSettings({settings:s,onChange}:{settings:StrikeSettings;onChange:(p:Partial<StrikeSettings>)=>void}){
 return <div className="ks-settings ks-graphics"><h2>Görüntü ve ses</h2><p>Değişiklikler açık maçta da uygulanır. Yüksek: 1024 px dokular ve gölgeler; Orta: 512 px; Düşük: 128 px ve sade çevre detayları.</p>
 <label>Grafik Kalitesi<select aria-label="Grafik Kalitesi" value={s.quality} onChange={e=>onChange({quality:e.target.value as StrikeSettings['quality']})}><option value="auto">Otomatik</option><option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option></select></label>
 {([{key:'scale',label:'Çözünürlük Ölçeği',min:.5,max:1.5,step:.05},{key:'fov',label:'Görüş Açısı (FOV)',min:65,max:115,step:1},{key:'sensitivity',label:'Fare Hassasiyeti',min:.15,max:3,step:.05},{key:'volume',label:'Genel Ses',min:0,max:1,step:.05},{key:'effectsVolume',label:'Silah ve çevre sesleri',min:0,max:1,step:.05},{key:'voiceVolume',label:'Sesli sohbet',min:0,max:1.5,step:.05}] as const).map(r=><label key={r.key}>{r.label} · {(s[r.key]??.8).toFixed(r.key==='fov'?0:2)}<input type="range" min={r.min} max={r.max} step={r.step} value={s[r.key]??.8} onChange={e=>onChange({[r.key]:Number(e.target.value)})}/></label>)}
 <label className="ks-check"><input type="checkbox" checked={s.dynamicResolution!==false} onChange={e=>onChange({dynamicResolution:e.target.checked})}/> Performansa göre çözünürlük ayarla</label>
 <label className="ks-check"><input type="checkbox" checked={s.invertY} onChange={e=>onChange({invertY:e.target.checked})}/> Dikey bakışı ters çevir</label>
 <label className="ks-check"><input type="checkbox" checked={s.showDebugStats===true} onChange={e=>onChange({showDebugStats:e.target.checked})}/> Ayrıntılı performans göstergesi</label></div>;
}
