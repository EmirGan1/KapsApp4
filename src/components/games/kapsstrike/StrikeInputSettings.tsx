import type {StrikeSettings} from '../../../games/kapsstrike/types';
import {GYRO_STATUS} from '../../../utils/gameGyroscope';
import type {GameGyroscope} from '../../../hooks/useGameGyroscope';
export default function StrikeInputSettings({settings,onChange,gyro,onOpenTouchCustomizer}:{settings:StrikeSettings;onChange:(s:Partial<StrikeSettings>)=>void;gyro:GameGyroscope;onOpenTouchCustomizer?:()=>void}){
 const changeGyro=async(mode:'off'|'ads'|'always')=>{
  if(mode==='off'){onChange({gyroMode:mode});return;}
  if(gyro.permissionGranted||await gyro.request())onChange({gyroMode:mode});
 };
 return <div className="ks-input-settings">
  <h3>Mobil Kontroller ve Jiroskop</h3>
  
  {onOpenTouchCustomizer && (
    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-black text-amber-300 uppercase tracking-wide">
          🎮 PUBG Stili Mobil Tuş Düzeni
        </div>
        <div className="text-[11px] text-slate-300 mt-0.5">
          Ateş, Dürbün, Zıplama, İnceleme ve Çömelme tuşlarının yerini ve büyüklüğünü ayarla
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenTouchCustomizer}
        className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black shrink-0 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
      >
        Düzeni Özelleştir
      </button>
    </div>
  )}

  <label>Kontrol düzeni<select aria-label="Kontrol düzeni" value={settings.controlMode||'auto'} onChange={e=>onChange({controlMode:e.target.value as StrikeSettings['controlMode']})}>
   <option value="auto">Otomatik · telefon/tablette dokunmatik</option><option value="touch">Mobil · dokunmatik kontroller</option><option value="keyboard">Klavye ve fare</option>
  </select></label>
  <p>Tabletlerde joystick ve dokunmatik düğmeler varsayılan olarak açılır. Harici klavye/fare için düzeni değiştirebilirsin.</p>
  <label><input type="checkbox" aria-label="Dokunmatik nişan desteği" checked={settings.touchAimAssist!==false} onChange={e=>onChange({touchAimAssist:e.target.checked})}/>Dokunmatik nişan desteği</label>
  <p>Görünür rakibin yakınında kaydırma %28 yavaşlar. Yalnızca dokunmatik bakışa uygulanır; otomatik nişan veya ateş yoktur. Fare ve jiroskop hassasiyeti değişmez.</p>
  <label>Jiroskop modu<select aria-label="Jiroskop modu" value={settings.gyroMode||'off'} onChange={e=>void changeGyro(e.target.value as 'off'|'ads'|'always')}>
   <option value="off">Kapalı</option><option value="ads">Yalnız nişan alırken (ADS)</option><option value="always">Her zaman</option>
  </select></label>
  <div className="ks-feature-shortcuts">
   <button type="button" onClick={()=>void changeGyro(settings.gyroMode&&settings.gyroMode!=='off'?settings.gyroMode:'always')}>Jiroskobu etkinleştir / izin ver</button>
   <button type="button" onClick={gyro.recenter}>Jiroskobu yeniden ortala</button>
  </div>
  <p role="status" data-gyro-status={gyro.status}>{GYRO_STATUS[gyro.status]}</p>
  <label>Jiroskop hassasiyeti · {(settings.gyroSensitivity??1).toFixed(1)}×<input aria-label="Jiroskop hassasiyeti" type="range" min=".1" max="4" step=".1" value={settings.gyroSensitivity??1} onChange={e=>onChange({gyroSensitivity:Number(e.target.value)})}/></label>
 </div>;
}
