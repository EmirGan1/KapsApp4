import { MapDefinition, MapId, Solid } from "./types";
function build(id: MapId): MapDefinition {
  const solids: Solid[] = [];
  let serial = 0;
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    detail = false,
  ) =>
    solids.push({
      id: `${id}-${++serial}`,
      kind: "box",
      x,
      y,
      z,
      w,
      h,
      d,
      color,
      detail,
    });
  const ramp = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    axis: "x" | "z",
    color: string,
  ) =>
    solids.push({
      id: `${id}-${++serial}`,
      kind: "ramp",
      x,
      y,
      z,
      w,
      h,
      d,
      axis,
      color,
    });
  for (const x of [-38, 38]) box(x, 0, 0, 1, 5, 76, "#52616c");
  for (const z of [-38, 38]) box(0, 0, z, 76, 5, 1, "#52616c");
  const base = {
    id,
    bounds: 38,
    solids,
    spawns: [
      { x: 0, y: 0, z: -28 },
      { x: -24, y: 0, z: -25 },
      { x: 24, y: 0, z: 27 },
      { x: -24, y: 0, z: 24 },
      { x: 0, y: 0, z: 27 },
      { x: 24, y: 0, z: -25 },
      { x: -24, y: id === 'neon' ? 5*15/18 : 0, z: 0 },
      { x: 24, y: id === 'neon' ? 3 : 0, z: 0 },
      { x: -10, y: 0, z: -28 },
      { x: 10, y: 0, z: 28 },
    ],
    targets: [
      { id: "close", position: { x: 0, y: 0, z: -15 } },
      { id: "mid", position: { x: -12, y: 0, z: 8 } },
      { id: "far", position: { x: 20, y: 0, z: 27 } },
      { id: "elevated", position: { x: 5, y: 3, z: 13 } },
      { id: "strafer", position: { x: 13, y: 0, z: -10 }, moving: true },
    ],
    hazard: { x: -21, z: 27, r: 3 },
  };
  if (id === "warehouse") {
    box(-30, 0, 6, 6, 9, 43, "#3c535d");
    box(30, 0, 6, 6, 9, 43, "#3c535d");
    box(0, 0, 31, 54, 9, 4, "#3c535d");
    for (const x of [-17, 17])
      for (const z of [-12, 8]) {
        box(x, 0, z, 6, 3.1, 11, x < 0 ? "#b66c3d" : "#467b87");
        for (let i = -4; i <= 4; i += 2)
          box(x, 0, z + i, 6.08, 2.85, 0.12, "#263e49", true);
      }
    box(0, 0, 13, 16, 3, 7, "#52646c");
    ramp(-5, 0, 2, 4, 3, 14, "z", "#718692");
    for (let i = 0; i < 8; i++)
      box(12, 0, -1 + i * 0.5, 3, (i + 1) * 0.25, 0.5, "#718692");
    box(12, 0, 5, 6, 2, 5, "#718692");
    for (const [x, z] of [
      [-8, -5],
      [7, -10],
      [-9, 22],
      [22, 23],
    ])
      box(x, 0, z, 2.5, 1.5, 2.5, "#aa9066");
    for (const x of [-25, 25])
      for (const z of [-23, 0, 24]) {
        box(x, 0, z, 0.55, 10, 0.55, "#c6b080");
        box(x, 9.5, z, 8, 0.3, 0.4, "#c6b080", true);
      }
    return {
      ...base,
      name: "Warehouse · Aktarma 07",
      subtitle: "Konteyner koridorları, yükleme rampası ve servis merdiveni",
      sky: "#81959e",
      floor: "#45515a",
    };
  }
  if (id === "dust") {
    const building = (
      x: number,
      z: number,
      w: number,
      d: number,
      color: string,
    ) => {
      box(x - w / 4 - 0.5, 0, z, w / 2 - 1, 3.5, 0.5, color);
      box(x + w / 4 + 0.5, 0, z, w / 2 - 1, 3.5, 0.5, color);
      box(x, 2.4, z, 2, 1.1, 0.5, color);
      box(x, 5, z, w, 1, 0.5, color);
      box(x - w / 2 + 0.3, 0, z, 0.6, 6, d, color);
      box(x + w / 2 - 0.3, 0, z, 0.6, 6, d, color);
      box(x, 0, z + d / 2, w, 6, 0.5, color);
      box(x, 6, z + d / 4, w, 0.4, d / 2, color);
    };
    building(-17, 4, 12, 13, "#bc9872");
    building(19, 11, 12, 15, "#cbab7e");
    building(-17, -18, 12, 7, "#a67e63");
    box(7, 0, 13, 12, 3, 9, "#a98763");
    ramp(-4, 0, 11, 9, 3, 4, "x", "#d0ad80");
    for (let i = 0; i < 12; i++)
      box(9, 0, 3 + i * 0.45, 3, (i + 1) * 0.25, 0.45, "#b39670");
    box(0, 0, -2, 6, 1.4, 3, "#b29677");
    box(-3, 1.4, -2, 0.4, 2.2, 3, "#8b7159");
    box(3, 1.4, -2, 0.4, 2.2, 3, "#8b7159");
    box(0, 3.6, -2, 6.5, 0.4, 3.5, "#8b7159");
    for (const [x, z] of [
      [-7, -11],
      [12, -13],
      [-5, 23],
      [26, -2],
    ]) {
      box(x, 0, z, 3, 1.25, 2, "#9b7959");
      box(x, 1.25, z, 2.8, 0.12, 1.8, "#dfbc86", true);
    }
    return {
      ...base,
      name: "Dust Town · Sarı Geçit",
      subtitle: "Avlular, kemerli geçişler, pencereler ve çatı yolları",
      sky: "#d6b992",
      floor: "#ba9d74",
    };
  }
  box(0, 0, 13, 18, 3, 10, "#36465c");
  box(-18, 0, 1, 9, 5, 15, "#354458");
  box(19, 0, 15, 8, 6, 15, "#354458");
  ramp(-5, 0, 0, 5, 3, 16, "z", "#5d7191");
  ramp(-25, 0, -6, 6, 5, 18, "z", "#526a84");
  ramp(25, 0, 0, 5, 6, 24, "z", "#526a84");
  box(0, 4.5, 4, 36, 0.5, 3, "#536781");
  box(0, 3, 23, 32, 0.4, 4, "#536781");
  for (const [x, z] of [
    [-8, -10],
    [9, -13],
    [-12, 22],
    [25, -16],
    [0, 0],
  ]) {
    box(x, 0, z, 2.7, 2.2, 2.7, "#3f546a");
    box(x, 2.2, z, 2.8, 0.1, 2.8, "#55dad7", true);
  }
  for (const x of [-30, 30]) {
    box(x, 0, 10, 0.5, 8, 44, "#2e3b50");
    box(x, 7.5, 10, 0.6, 0.25, 44, "#a475f4", true);
  }
  return {
    ...base,
    name: "Neon Arena · Prizma",
    subtitle: "İki seviyeli köprüler, yan rampalar ve dikey çatışma",
    sky: "#151f35",
    floor: "#263548",
  };
}
export const MAPS: Record<MapId, MapDefinition> = {
  warehouse: build("warehouse"),
  dust: build("dust"),
  neon: build("neon"),
};
