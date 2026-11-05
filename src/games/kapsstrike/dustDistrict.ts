export const dustDistrict: any = {
  id: "district",
  name: "Dust District",
  bounds: 80,
  spawns: [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: -2, y: 0, z: 0 },
    { x: 0, y: 0, z: 2 },
    { x: 0, y: 0, z: -2 },
    { x: 4, y: 0, z: 0 },
    { x: -4, y: 0, z: 0 },
    { x: 0, y: 0, z: 4 },
    { x: 0, y: 0, z: -4 },
    { x: 6, y: 0, z: 0 }
  ],
  solids: [
    { id: "floor-main", x: 0, y: -0.5, z: 0, w: 160, h: 1, d: 160, kind: "box", surface: "concrete" },
    { id: "entry-lintel-1", x: 0, y: 3, z: 10, w: 4, h: 1, d: 2, kind: "box", surface: "concrete" },
    { id: "ramp-1", x: 5, y: 1, z: 5, w: 4, h: 2, d: 8, kind: "ramp", surface: "wood" },
    { id: "window-1", x: 10, y: 2, z: 0, w: 1, h: 2, d: 3, kind: "box", surface: "glass" },
    { id: "stair-tread-short-1", x: 15, y: 0.5, z: 0, w: 3, h: 0.5, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-2", x: 15, y: 1.0, z: 1, w: 3, h: 1.0, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-3", x: 15, y: 1.5, z: 2, w: 3, h: 1.5, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-4", x: 15, y: 2.0, z: 3, w: 3, h: 2.0, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-5", x: 15, y: 2.5, z: 4, w: 3, h: 2.5, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-6", x: 15, y: 3.0, z: 5, w: 3, h: 3.0, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-7", x: 15, y: 3.5, z: 6, w: 3, h: 3.5, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-8", x: 15, y: 4.0, z: 7, w: 3, h: 4.0, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-9", x: 15, y: 4.5, z: 8, w: 3, h: 4.5, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-10", x: 15, y: 5.0, z: 9, w: 3, h: 5.0, d: 1, kind: "box", surface: "concrete" },
    { id: "stair-tread-short-11", x: 15, y: 5.5, z: 10, w: 3, h: 5.5, d: 1, kind: "box", surface: "concrete" }
  ],
  routes: [
    {
      name: "route-a",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 5, y: 0, z: 10 },
        { x: 10, y: 0, z: 20 }
      ]
    },
    {
      name: "route-b",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: -5, y: 0, z: -10 },
        { x: -10, y: 0, z: -20 }
      ]
    },
    {
      name: "route-mid",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 20, y: 0, z: 0 }
      ]
    }
  ]
};
