import type {StrikeSettings} from '../../../games/kapsstrike/types';
import {GYRO_STATUS} from '../../../utils/gameGyroscope';
import type {GameGyroscope} from '../../../hooks/useGameGyroscope';
export default function StrikeInputSettings({settings,onChange,gyro}:{settings:StrikeSettings;onChange:(s:Partial<StrikeSettings>)=>void;gyro:GameGyroscope}){
 const changeGyro=async(mode:'off'|'ads'|'always')=>{
  if(mode==='off'){onChange({gyroMode:mode});return;}
  if(gyro.permissionGranted||await gyro.request())onChange({gyroMode:mode});
 };
 return <div className="ks-input-settings">
  <h3>Mobil Kontroller ve Jiroskop</h3>
  <label>Kontrol düzeni<select aria-label="Kontrol düzeni" value={settings.controlMode||'auto'} onChange={e=>onChange({controlMode:e.target.value as StrikeSettings['controlMode']})}>
   <option value="auto">Otomatik · telefon/tablette dokunmatik</option><option value="touch">Mobil · dokunmatik kontroller</option><option value="keyboard">Klavye ve fare</option>
  </select></label>
  <p>Tabletlerde joystick ve dokunmatik düğmeler varsayılan olarak açılır. Harici klavye/fare için düzeni değiştirebilirsin.</p>
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
