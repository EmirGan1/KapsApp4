import catalog from './catalogPbr.json';
import type { MapDefinition, Solid } from './types';

type CatalogMaterial = keyof typeof catalog.materials;
export type CatalogMaps = { albedo: string; normal?: string; orm?: string };
export const catalogMaterials = catalog.materials;

export function catalogMaterial(map: MapDefinition, surface: Solid['surface'], solid?: Solid): CatalogMaterial | undefined {
  if (map.id !== 'district' && map.id !== 'bolluca') return;
  const dust = map.id === 'district';
  if (!solid) return dust ? 'dustGround' : 'bollucaGround';
  if (solid.label || solid.glow || /photo|poster|mural|logo|sign|site-mark/i.test(solid.id)) return;
  // Photo panels and their backing solids keep their existing material and UVs.
  if (map.photoFrames?.some(frame =>
    Math.abs(frame.x - solid.x) <= solid.w / 2 + Math.abs(Math.cos(frame.rotationY)) * frame.width / 2 + .22 &&
    Math.abs(frame.z - solid.z) <= solid.d / 2 + Math.abs(Math.sin(frame.rotationY)) * frame.width / 2 + .22 &&
    Math.abs(frame.y - solid.y - solid.h / 2) <= (frame.height + solid.h) / 2 + .22
  )) return;

  const id = solid.id;
  const interior = !dust && /palace|market|apps|kitchen/.test(id);
  if (/wheel|tire/.test(id)) return 'rubber';
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
