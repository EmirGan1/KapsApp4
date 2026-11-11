import { catalogMaterial } from './catalogMaterials';
import type { MapDefinition, Solid } from './types';

/** Small trim attached to existing props. Only the renderer sees these solids. */
export function catalogDetails(map: MapDefinition): Solid[] {
  if (map.id !== 'district' && map.id !== 'bolluca') return [];
  const details: Solid[] = [];
  for (const solid of map.solids) {
    if (solid.hidden || !catalogMaterial(map, solid.surface, solid)) continue;
    const add = (suffix: string, patch: Partial<Solid>) => details.push({
      ...solid, id: solid.id + '-trim-' + suffix, detail: true, ...patch,
    });

    if (/barrel/.test(solid.id) && solid.shape === 'cylinder' && solid.h > .55) {
      for (const band of [.21, .73]) {
        add('hoop-' + band, { y: solid.y + solid.h * band, w: solid.w + .024,
          d: solid.d + .024, h: .035, color: '#566363', surface: 'metal' });
      }
      add('cap', { y: solid.y + solid.h, w: .085, d: .085, h: .018,
        color: '#655b4f', surface: 'metal', x: solid.x + solid.w * .22 });
    }

    if (solid.kind === 'box' && solid.surface === 'wood' && /crate/.test(solid.id)
      && !/lid|band|upper|top/.test(solid.id) && solid.h > .65 && solid.w > .7) {
      for (const side of [-1, 1]) {
        add('runner-' + side, { x: solid.x + side * solid.w * .31, y: solid.y + solid.h,
          w: .095, d: solid.d, h: .028, color: '#8f7353', surface: 'wood' });
      }
    }

    if (/van$|car-chassis/.test(solid.id) && solid.kind === 'box' && solid.w > 1.4) {
      for (const side of [-1, 1]) {
        add('bumper-fastener-' + side, { x: solid.x + side * solid.w * .33,
          z: solid.z + solid.d / 2, y: solid.y + solid.h * .19,
          w: .12, d: .055, h: .08, color: '#716c60', surface: 'metal' });
      }
    }
  }
  return details;
}
