import catalog from './catalogPbr.json';
import type { MapDefinition, Solid } from './types';

type CatalogMaterial = keyof typeof catalog.materials;
export type CatalogMaps = { albedo: string; normal?: string; orm?: string };
export const catalogMaterials = catalog.materials;

export function catalogMaterial(map: MapDefinition, surface: Solid['surface'], solid?: Solid): CatalogMaterial | undefined {
  if (map.id !== 'district' && map.id !== 'bolluca' && map.id !== 'dust2v2' && map.id !== 'bollucav2') return;
  const isDust2V2 = map.id === 'dust2v2';
  const isBollucaV2 = map.id === 'bollucav2';
  const dust = map.id === 'district' || isDust2V2;

  if (!solid) {
    if (isBollucaV2) return 'stoneFloor';
    return dust ? 'dustGround' : 'bollucaGround';
  }
  if (solid.label || solid.glow || /photo|poster|mural|logo|sign|site-mark|target-border/i.test(solid.id)) return;

  // Photo panels and their backing solids keep their existing material and UVs.
  if (map.photoFrames?.some(frame =>
    Math.abs(frame.x - solid.x) <= solid.w / 2 + Math.abs(Math.cos(frame.rotationY)) * frame.width / 2 + .22 &&
    Math.abs(frame.z - solid.z) <= solid.d / 2 + Math.abs(Math.sin(frame.rotationY)) * frame.width / 2 + .22 &&
    Math.abs(frame.y - solid.y - solid.h / 2) <= (frame.height + solid.h) / 2 + .22
  )) return;

  const id = solid.id;
  if (/wheel|tire/.test(id)) return 'rubber';
  if (/sandbag|sack/.test(id) && surface === 'fabric') return 'hessianFabric';

  // --- SELECTIVE HIGH/MEDIUM PBR ROUTING FOR DUST II V2 ---
  // Preserves already-clean sandy_gravel_02 ground, wooden crates, weathered wood,
  // asphalt, brick, rubber, and rusted barrels; selectively upgrades blotchy facades,
  // industrial containers/cars, tunnel concrete, ramps/platforms, and carved sandstone.
  if (isDust2V2) {
    if (/crate|pallet|xbox|default|quad|ninja|green-box/.test(id) && surface === 'wood') return 'crate';
    switch (surface) {
      case 'sand': return 'dustMid';
      case 'plaster':
        // Retain damaged_plaster only for weathered ruins, arches, and damaged trims.
        if (/b-window|remnant|ruin|bulkhead|frieze|ledge/.test(id)) return 'dustPlaster';
        return 'dustFacadePlaster';
      case 'stone':
        if (/upper-tunnel.*wall|lower-tunnel.*wall|tunnel-stairs-wall|tunnel-entrance-wall|pit-retaining|pit-back-bunker/.test(id)) {
          return 'crackedConcreteWall';
        }
        if (/tunnel.*(?:floor|tread|infill)|underpass|stairs.*roof|curb|coping|plinth/.test(id)) {
          return 'concretePavement';
        }
        if (/mid.*(?:floor|path|ramp)|pit.*(?:floor|basin)/.test(id)) return 'dustMid';
        if (/parapet|cornice|sill|arch-pier|column|cap|goose|lintel/.test(id)) return 'whiteSandstone';
        if (/wall|arch|pier|b-doors|b-site/.test(id)) return 'dustStone';
        if (/floor|deck|ramp|slope|tread|infill|site-west|site-east|catwalk|plat|base|flat|landing/.test(id)) {
          return 'stoneFloor';
        }
        return 'dustStone';
      case 'concrete':
        if (/mid|long|ramp/.test(id)) return 'dustMid';
        if (/wall|pier|bulkhead/.test(id)) return 'crackedConcreteWall';
        return 'concretePavement';
      case 'metal':
        if (/car|chassis|hood|cab/.test(id)) return 'paintedMetal';
        if (/container|shutter|door|gate|rib|rail|vent|grate|frame|scaffold/.test(id)) return 'corrugatedMetal';
        return 'metal';
      case 'wood': return 'wood';
      case 'brick': return 'brick';
      case 'fabric': return 'fabric';
      case 'asphalt': return 'asphalt';
      case 'glass':
      case 'water': return;
      default: return 'dustFacadePlaster';
    }
  }

  // --- REGIONAL MOROCCAN PBR ROUTING FOR BOLLUCA V2 (CS:GO MIRAGE) ---
  if (isBollucaV2) {
    const interior = /palace|market|apps|kitchen|connector|window-room|ladder-room|underpass/.test(id);
    if (/roof|canopy-cap/.test(id) && !interior && surface !== 'metal' && !/van|ticket/.test(id)) return 'roof';
    if (/crate|pallet|tetris|triple|firebox|ninja|shadow|default|cart|box/.test(id) && surface === 'wood') return 'crate';
    switch (surface) {
      case 'sand': return 'bollucaGround';
      case 'plaster':
        if (/window|jungle|market|ticket/.test(id) && !/sill|jamb|header|counter/.test(id)) return 'bollucaBlue';
        if (/palace|apps/.test(id)) return 'paintedPlaster';
        if (/b-site|connector|ct-/.test(id)) return 'beigePlaster';
        return 'bollucaPlaster';
      case 'stone':
        if (/b-site-plinth/.test(id)) return 'redSandstone';
        if (/arch|pier|column|parapet|cornice|trim|frame|sill|header|plinth|dado|cap|spandrel|curb|coping|minaret|cupola|wainscot/.test(id)) {
          return 'whiteSandstone';
        }
        if (interior && /floor|deck|hall|landing|step|tile-band/.test(id)) return 'interiorTile';
        if (/slope|ramp|step|deck|a-platform|catwalk|top-mid/.test(id)) return 'stoneFloor';
        if (/wall|sandwich/.test(id)) return 'dustStone';
        return 'bollucaStone';
      case 'wood':
        if (interior || /shelf|counter|beam|joist|pergola|bench|chair/.test(id)) return 'interiorWood';
        return 'wood';
      case 'concrete': return interior ? 'interiorTile' : 'concretePavement';
      case 'metal':
        if (/van-body|van-cab-hood/.test(id)) return;
        if (/ticket-roof|ticket-shutter|ebox/.test(id)) return 'paintedMetal';
        if (/vent|shutter|rail|baluster|post|wire|ladder|frame|canopy|van-/.test(id)) return 'corrugatedMetal';
        return 'metal';
      case 'brick': return 'brick';
      case 'fabric': return 'hessianFabric';
      case 'asphalt': return 'asphalt';
      case 'glass':
      case 'water': return;
      default: return 'bollucaPlaster';
    }
  }

  // --- ORIGINAL DISTRICT & BOLLUCA (PRESERVED UNTOUCHED) ---
  const interior = !dust && /palace|market|apps|kitchen/.test(id);
  if (!dust && /roof|canopy-cap/.test(id) && !interior && surface !== 'metal') return 'roof';
  if (/crate|pallet/.test(id) && surface === 'wood') return 'crate';
  switch (surface) {
    case 'sand': return dust ? 'dustMid' : 'bollucaGround';
    case 'stone':
      if (dust) {
        if (/tunnel.*(?:floor|tread)|underpass|stairs.*roof/.test(id)) return 'dustConcrete';
        if (/mid.*(?:floor|path|ramp)|pit.*(?:floor|platform)/.test(id)) return 'dustMid';
        if (/wall|arch|parapet|pier|column/.test(id)) return 'dustStone';
        if (/floor|deck|ramp|tread|curb|infill/.test(id)) return 'bollucaStone';
        return 'dustStone';
      }
      if (interior || /connector.*(?:step|deck)|jungle.*floor/.test(id)) return 'interiorTile';
      if (/wall|pier|column|minaret/.test(id)) return 'dustStone';
      return 'bollucaStone';
    case 'plaster':
      if (dust) return 'dustPlaster';
      return /window|jungle|market/.test(id) && !/sill|jamb|header/.test(id) ? 'bollucaBlue' : 'bollucaPlaster';
    case 'wood': return interior ? 'interiorWood' : 'wood';
    case 'concrete': return dust && /mid|long|ramp/.test(id) ? 'dustMid' : interior ? 'interiorTile' : 'dustConcrete';
    case 'brick': return 'brick';
    case 'metal': return 'metal';
    case 'fabric': return 'fabric';
    case 'asphalt': return 'asphalt';
    case 'glass':
    case 'water': return;
    default: return dust ? 'dustPlaster' : 'bollucaPlaster';
  }
}
