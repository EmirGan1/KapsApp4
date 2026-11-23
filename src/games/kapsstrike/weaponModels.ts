import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { WeaponId } from "./types";
import {
  getWeaponRoleMaterial,
  type WeaponQualityTier,
  type WeaponSurfaceRole,
} from "./weaponMaterials";

export type WeaponDetailLevel = "fp" | "world";

export interface WeaponBuildOptions {
  detail: WeaponDetailLevel;
  quality?: WeaponQualityTier;
  prefix?: string;
  renderingGroupId?: number;
  knifeStyle?: "default" | "tanto" | "karambit" | "butterfly";
}

interface LoftStation {
  z: number;
  y: number;
  hw: number;
  hh: number;
  chamfer?: number;
  topSlope?: number;
}

/**
 * Generates an 8-point chamfered/beveled cross-section polygon in the XY plane.
 * Produces smooth hard-surface receivers, contoured gunstocks, slides, grips, and forends
 * instead of sharp primitive boxes.
 */
function chamferSection(st: LoftStation): Array<[number, number]> {
  const w = Math.max(0.001, st.hw);
  const h = Math.max(0.001, st.hh);
  const c = Math.min(w * 0.65, h * 0.65, st.chamfer ?? Math.min(w, h) * 0.28);
  const topW = w * (1 - (st.topSlope ?? 0));
  const topC = Math.min(topW * 0.65, c);
  const y = st.y;
  return [
    [-topW + topC, y + h],
    [topW - topC, y + h],
    [topW, y + h - topC],
    [w, y - h + c],
    [w - c, y - h],
    [-w + c, y - h],
    [-w, y - h + c],
    [-topW, y + h - topC],
  ];
}

/**
 * Lofts a closed manifold hard-surface 3D mesh along a sequence of beveled XY stations along Z,
 * with continuous side-projected weapon-space UVs so weapon skins wrap seamlessly without distortion.
 */
function buildLoftedPart(
  scene: Scene,
  name: string,
  stations: LoftStation[],
  uvScale = 2.6,
): Mesh {
  const rings = stations.map(chamferSection);
  const ringLen = rings[0].length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let minZ = Infinity;
  let minY = Infinity;
  for (let s = 0; s < stations.length; s++) {
    minZ = Math.min(minZ, stations[s].z);
    for (const [, py] of rings[s]) minY = Math.min(minY, py);
  }

  // Side walls with clean vertex rings
  for (let s = 0; s < stations.length; s++) {
    const z = stations[s].z;
    const ring = rings[s];
    for (let i = 0; i < ringLen; i++) {
      const [px, py] = ring[i];
      positions.push(px, py, z);
      // Continuous side-projected planar UV across the length and height of the weapon
      uvs.push((z - minZ) * uvScale, (py - minY) * uvScale);
    }
  }

  for (let s = 0; s < stations.length - 1; s++) {
    const a0 = s * ringLen;
    const b0 = (s + 1) * ringLen;
    for (let i = 0; i < ringLen; i++) {
      const next = (i + 1) % ringLen;
      const p0 = a0 + i;
      const p1 = a0 + next;
      const p2 = b0 + next;
      const p3 = b0 + i;
      indices.push(p0, p1, p2);
      indices.push(p0, p2, p3);
    }
  }

  // Start cap (facing -Z)
  const startCenterIdx = positions.length / 3;
  positions.push(0, stations[0].y, stations[0].z);
  uvs.push(0, (stations[0].y - minY) * uvScale);
  for (let i = 0; i < ringLen; i++) {
    const next = (i + 1) % ringLen;
    indices.push(startCenterIdx, next, i);
  }

  // End cap (facing +Z)
  const lastBase = (stations.length - 1) * ringLen;
  const endCenterIdx = positions.length / 3;
  const lastSt = stations[stations.length - 1];
  positions.push(0, lastSt.y, lastSt.z);
  uvs.push((lastSt.z - minZ) * uvScale, (lastSt.y - minY) * uvScale);
  for (let i = 0; i < ringLen; i++) {
    const next = (i + 1) % ringLen;
    indices.push(endCenterIdx, lastBase + i, lastBase + next);
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);

  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.applyToMesh(mesh);
  return mesh;
}

/**
 * Turns a rotational profile of [z, radius] points around the +Z axis.
 * Used for stepped barrels, muzzle brakes, suppressors, telescopic sniper scopes,
 * ribbed shotgun pumps, magazine tubes, and bolt knobs.
 */
function buildTurnedZ(
  scene: Scene,
  name: string,
  profile: Array<[z: number, radius: number]>,
  tessellation: number,
  yCenter = 0,
  xCenter = 0,
): Mesh {
  const shape = profile.map(([z, r]) => new Vector3(Math.max(0.0005, r), z, 0));
  const mesh = MeshBuilder.CreateLathe(
    name,
    { shape, tessellation, cap: Mesh.CAP_ALL, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  // Rotate lathe axis from +Y to +Z
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(xCenter, yCenter, 0);
  // Re-bake transform so vertex normals/UVs stay aligned in weapon space
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}

/**
 * Sweeps a beveled rectangular cross-section along a curved 3D spine in the YZ plane.
 * Creates authentic curved AK-47 banana magazines, MP5 curved stick mags, and STANAG mags.
 */
function buildCurvedBlock(
  scene: Scene,
  name: string,
  spine: Array<{ z: number; y: number; halfW: number; halfD: number; chamfer?: number }>,
  uvScale = 2.8,
): Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ringLen = 8;

  for (let s = 0; s < spine.length; s++) {
    const cur = spine[s];
    const prev = spine[Math.max(0, s - 1)];
    const next = spine[Math.min(spine.length - 1, s + 1)];
    const tz = next.z - prev.z;
    const ty = next.y - prev.y;
    const len = Math.hypot(tz, ty) || 1;
    // Perpendicular vector in YZ plane (normal to spine)
    const nz = -ty / len;
    const ny = tz / len;

    const w = cur.halfW;
    const d = cur.halfD;
    const c = Math.min(w * 0.45, d * 0.38, cur.chamfer ?? Math.min(w, d) * 0.25);

    const local: Array<[number, number]> = [
      [-w + c, d],
      [w - c, d],
      [w, d - c],
      [w, -d + c],
      [w - c, -d],
      [-w + c, -d],
      [-w, -d + c],
      [-w, d - c],
    ];

    for (const [lx, ld] of local) {
      const px = lx;
      const py = cur.y + ny * ld;
      const pz = cur.z + nz * ld;
      positions.push(px, py, pz);
      uvs.push(pz * uvScale, py * uvScale);
    }
  }

  for (let s = 0; s < spine.length - 1; s++) {
    const a0 = s * ringLen;
    const b0 = (s + 1) * ringLen;
    for (let i = 0; i < ringLen; i++) {
      const next = (i + 1) % ringLen;
      indices.push(a0 + i, a0 + next, b0 + next);
      indices.push(a0 + i, b0 + next, b0 + i);
    }
  }

  // Cap top & bottom
  const topCenter = positions.length / 3;
  positions.push(0, spine[0].y, spine[0].z);
  uvs.push(spine[0].z * uvScale, spine[0].y * uvScale);
  for (let i = 0; i < ringLen; i++) {
    indices.push(topCenter, (i + 1) % ringLen, i);
  }
  const lastBase = (spine.length - 1) * ringLen;
  const botCenter = positions.length / 3;
  const last = spine[spine.length - 1];
  positions.push(0, last.y, last.z);
  uvs.push(last.z * uvScale, last.y * uvScale);
  for (let i = 0; i < ringLen; i++) {
    indices.push(botCenter, lastBase + i, lastBase + ((i + 1) % ringLen));
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.applyToMesh(mesh);
  return mesh;
}

/**
 * Lofts a hollow-ground/beveled knife blade along Z from tang to razor tip,
 * producing authentic sharp edges, spine ridges, clip-points, or angular tanto chisel tips.
 */
function buildSculptedBlade(
  scene: Scene,
  name: string,
  stations: Array<{ z: number; spineY: number; edgeY: number; halfThick: number }>,
): Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // 6-point diamond-bevel blade cross-section:
  // spine-left, spine-right, mid-right, edge-apex, mid-left
  const ringLen = 5;
  const minZ = stations[0].z;
  const spanZ = Math.max(0.05, stations[stations.length - 1].z - minZ);

  for (const st of stations) {
    const midY = st.edgeY + (st.spineY - st.edgeY) * 0.56;
    const t = st.halfThick;
    const spineHalf = t * 0.72;
    const pts: Array<[number, number]> = [
      [-spineHalf, st.spineY],
      [spineHalf, st.spineY],
      [t, midY],
      [0, st.edgeY],
      [-t, midY],
    ];
    const u = (st.z - minZ) / spanZ;
    for (let i = 0; i < pts.length; i++) {
      positions.push(pts[i][0], pts[i][1], st.z);
      uvs.push(u * 1.4, (pts[i][1] + 0.05) * 8.0);
    }
  }

  for (let s = 0; s < stations.length - 1; s++) {
    const a0 = s * ringLen;
    const b0 = (s + 1) * ringLen;
    for (let i = 0; i < ringLen; i++) {
      const next = (i + 1) % ringLen;
      indices.push(a0 + i, a0 + next, b0 + next);
      indices.push(a0 + i, b0 + next, b0 + i);
    }
  }

  // Cap tang & tip
  const c0 = positions.length / 3;
  const first = stations[0];
  positions.push(0, (first.spineY + first.edgeY) * 0.5, first.z);
  uvs.push(0, 0.5);
  for (let i = 0; i < ringLen; i++) indices.push(c0, (i + 1) % ringLen, i);

  const lastBase = (stations.length - 1) * ringLen;
  const c1 = positions.length / 3;
  const last = stations[stations.length - 1];
  positions.push(0, (last.spineY + last.edgeY) * 0.5, last.z);
  uvs.push(1.4, 0.5);
  for (let i = 0; i < ringLen; i++) {
    indices.push(c1, lastBase + i, lastBase + ((i + 1) % ringLen));
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.applyToMesh(mesh);
  return mesh;
}

/**
 * Helper context for assembling a cohesive sculpted weapon hierarchy.
 */
function makePartHelper(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const finalize = (
    mesh: Mesh,
    role: WeaponSurfaceRole,
    skinnable = false,
    extraMeta?: Record<string, unknown>,
  ) => {
    mesh.parent = root;
    const mat = getWeaponRoleMaterial(scene, role, quality);
    mesh.material = mat;
    mesh.metadata = { baseMaterial: mat, skinnable, ...extraMeta };
    mesh.isPickable = false;
    if (renderingGroupId !== undefined) mesh.renderingGroupId = renderingGroupId;
    return mesh;
  };

  const loft = (
    name: string,
    stations: LoftStation[],
    role: WeaponSurfaceRole,
    skinnable = false,
    uvScale = 2.6,
    extraMeta?: Record<string, unknown>,
  ) => finalize(buildLoftedPart(scene, prefix + name, stations, uvScale), role, skinnable, extraMeta);

  const turned = (
    name: string,
    profile: Array<[number, number]>,
    tess: number,
    yCenter: number,
    xCenter: number,
    role: WeaponSurfaceRole,
    skinnable = false,
    extraMeta?: Record<string, unknown>,
  ) =>
    finalize(
      buildTurnedZ(scene, prefix + name, profile, tess, yCenter, xCenter),
      role,
      skinnable,
      extraMeta,
    );

  const curved = (
    name: string,
    spine: Array<{ z: number; y: number; halfW: number; halfD: number; chamfer?: number }>,
    role: WeaponSurfaceRole,
    skinnable = false,
    extraMeta?: Record<string, unknown>,
  ) => finalize(buildCurvedBlock(scene, prefix + name, spine), role, skinnable, extraMeta);

  const tube = (
    name: string,
    points: Vector3[],
    radius: number,
    tess: number,
    role: WeaponSurfaceRole,
    skinnable = false,
    extraMeta?: Record<string, unknown>,
  ) =>
    finalize(
      MeshBuilder.CreateTube(
        prefix + name,
        { path: points, radius, tessellation: tess, cap: Mesh.CAP_ALL },
        scene,
      ),
      role,
      skinnable,
      extraMeta,
    );

  const cyl = (
    name: string,
    diameter: number,
    height: number,
    tess: number,
    x: number,
    y: number,
    z: number,
    role: WeaponSurfaceRole,
    skinnable = false,
    extraMeta?: Record<string, unknown>,
  ) => {
    const m = MeshBuilder.CreateCylinder(
      prefix + name,
      { diameter, height, tessellation: tess },
      scene,
    );
    m.position.set(x, y, z);
    return finalize(m, role, skinnable, extraMeta);
  };

  const rail = (name: string, yTop: number, zStart: number, zEnd: number, width = 0.032, fp = true) => {
    loft(
      name,
      [
        { z: zStart, y: yTop, hw: width * 0.5, hh: 0.008, chamfer: 0.003 },
        { z: zEnd, y: yTop, hw: width * 0.5, hh: 0.008, chamfer: 0.003 },
      ],
      "darkMetal",
    );
    if (!fp) return;
    const step = 0.024;
    const count = Math.min(10, Math.floor((zEnd - zStart) / step));
    for (let i = 0; i < count; i++) {
      const z = zStart + 0.012 + i * step;
      loft(
        `${name}-lug-${i}`,
        [
          { z: z - 0.005, y: yTop + 0.007, hw: width * 0.48, hh: 0.0035, chamfer: 0.001 },
          { z: z + 0.005, y: yTop + 0.007, hw: width * 0.48, hh: 0.0035, chamfer: 0.001 },
        ],
        "steel",
      );
    }
  };

  return { finalize, loft, turned, curved, tube, cyl, rail };
}

/**
 * 1. AR-30 Yörünge — AK-47 / Kalashnikov Assault Rifle Archetype
 */
function buildRifleAK(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  detail: WeaponDetailLevel,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const fp = detail === "fp";
  const tess = fp ? 14 : 8;
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  // Sloped solid walnut AK buttstock
  h.loft(
    "stock",
    [
      { z: -0.44, y: -0.058, hw: 0.026, hh: 0.068, chamfer: 0.011 },
      { z: -0.34, y: -0.044, hw: 0.025, hh: 0.054, chamfer: 0.01 },
      { z: -0.22, y: -0.022, hw: 0.024, hh: 0.036, chamfer: 0.009 },
      { z: -0.14, y: -0.008, hw: 0.025, hh: 0.034, chamfer: 0.007 },
    ],
    "wood",
    true,
  );
  // Metal buttplate
  h.loft(
    "buttplate",
    [
      { z: -0.452, y: -0.059, hw: 0.027, hh: 0.069, chamfer: 0.009 },
      { z: -0.438, y: -0.058, hw: 0.027, hh: 0.069, chamfer: 0.009 },
    ],
    "darkMetal",
  );

  // Stamped steel AK receiver with sloped ribbed dust cover
  h.loft(
    "receiver",
    [
      { z: -0.145, y: 0.004, hw: 0.031, hh: 0.044, chamfer: 0.01, topSlope: 0.24 },
      { z: -0.11, y: 0.012, hw: 0.032, hh: 0.048, chamfer: 0.011, topSlope: 0.22 },
      { z: 0.08, y: 0.012, hw: 0.032, hh: 0.048, chamfer: 0.011, topSlope: 0.22 },
      { z: 0.145, y: 0.008, hw: 0.031, hh: 0.044, chamfer: 0.009, topSlope: 0.16 },
    ],
    "bluedSteel",
    true,
  );

  // Classic AK lower + upper contoured wooden handguard
  h.loft(
    "stock-handguard",
    [
      { z: 0.145, y: -0.004, hw: 0.029, hh: 0.032, chamfer: 0.012 },
      { z: 0.21, y: -0.008, hw: 0.032, hh: 0.036, chamfer: 0.014 },
      { z: 0.30, y: -0.005, hw: 0.029, hh: 0.033, chamfer: 0.013 },
      { z: 0.37, y: 0.002, hw: 0.025, hh: 0.028, chamfer: 0.011 },
    ],
    "wood",
    true,
  );
  // Upper gas tube handguard cover
  h.loft(
    "stock-upper-hg",
    [
      { z: 0.165, y: 0.033, hw: 0.022, hh: 0.015, chamfer: 0.01 },
      { z: 0.27, y: 0.035, hw: 0.023, hh: 0.016, chamfer: 0.01 },
      { z: 0.365, y: 0.033, hw: 0.021, hh: 0.014, chamfer: 0.009 },
    ],
    "wood",
    true,
  );

  // Turned stepped steel barrel + slant muzzle brake
  h.turned(
    "barrel-core",
    [
      [0.14, 0.016],
      [0.37, 0.014],
      [0.48, 0.0125],
      [0.64, 0.0115],
      [0.665, 0.013],
      [0.67, 0.0115],
    ],
    tess,
    0.016,
    0,
    "steel",
    true,
  );
  // Slant compensator muzzle brake (unpainted blued steel)
  h.turned(
    "muzzle-brake",
    [
      [0.665, 0.0145],
      [0.695, 0.0155],
      [0.72, 0.0135],
    ],
    tess,
    0.016,
    0,
    "darkMetal",
  );
  // Upper gas tube + 45-degree angled gas block
  h.turned(
    "gastube",
    [
      [0.36, 0.0105],
      [0.485, 0.0105],
    ],
    Math.max(8, tess - 2),
    0.039,
    0,
    "darkMetal",
  );
  h.loft(
    "gasblock",
    [
      { z: 0.455, y: 0.028, hw: 0.015, hh: 0.024, chamfer: 0.005 },
      { z: 0.495, y: 0.024, hw: 0.014, hh: 0.022, chamfer: 0.005 },
    ],
    "darkMetal",
  );
  // Under-barrel cleaning rod
  if (fp) {
    h.turned(
      "cleanrod",
      [
        [0.37, 0.0038],
        [0.635, 0.0038],
      ],
      6,
      -0.002,
      0,
      "steel",
    );
  }

  // Iconic curved 30-round AK banana magazine
  h.curved(
    "magazine",
    [
      { z: 0.055, y: -0.025, halfW: 0.02, halfD: 0.036, chamfer: 0.006 },
      { z: 0.072, y: -0.105, halfW: 0.0195, halfD: 0.036, chamfer: 0.006 },
      { z: 0.104, y: -0.185, halfW: 0.019, halfD: 0.035, chamfer: 0.006 },
      { z: 0.152, y: -0.258, halfW: 0.0195, halfD: 0.036, chamfer: 0.005 },
    ],
    "bluedSteel",
    true,
  );

  // Swept ergonomic AK pistol grip
  h.curved(
    "grip",
    [
      { z: -0.072, y: -0.032, halfW: 0.019, halfD: 0.026, chamfer: 0.008 },
      { z: -0.092, y: -0.095, halfW: 0.02, halfD: 0.027, chamfer: 0.009 },
      { z: -0.118, y: -0.158, halfW: 0.021, halfD: 0.029, chamfer: 0.008 },
    ],
    "darkWood",
  );

  // Curved steel trigger guard & trigger
  h.tube(
    "triggerguard",
    [
      new Vector3(0, -0.036, -0.055),
      new Vector3(0, -0.078, -0.038),
      new Vector3(0, -0.078, 0.015),
      new Vector3(0, -0.036, 0.028),
    ],
    0.0045,
    6,
    "darkMetal",
  );
  if (fp) {
    h.tube(
      "trigger",
      [new Vector3(0, -0.038, -0.025), new Vector3(0, -0.066, -0.033)],
      0.0038,
      6,
      "steel",
    );
    // Right-side bolt carrier + curved charging handle
    h.loft(
      "bolt-carrier",
      [
        { z: -0.02, y: 0.024, hw: 0.008, hh: 0.012, chamfer: 0.003 },
        { z: 0.09, y: 0.024, hw: 0.008, hh: 0.012, chamfer: 0.003 },
      ],
      "chrome",
    ).position.x = 0.028;
    h.tube(
      "charging-handle",
      [
        new Vector3(0.03, 0.024, 0.065),
        new Vector3(0.062, 0.028, 0.062),
        new Vector3(0.066, 0.036, 0.056),
      ],
      0.0055,
      6,
      "chrome",
    );
  }

  // Hooded AK front sight tower + rear tangent sight block
  h.loft(
    "front-sight-base",
    [
      { z: 0.612, y: 0.044, hw: 0.013, hh: 0.032, chamfer: 0.004 },
      { z: 0.648, y: 0.042, hw: 0.011, hh: 0.03, chamfer: 0.004 },
    ],
    "darkMetal",
  );
  h.cyl("front-sight-post", 0.006, 0.024, 6, 0, 0.076, 0.63, "sightDot");
  h.loft(
    "rear-sight-block",
    [
      { z: 0.105, y: 0.062, hw: 0.018, hh: 0.014, chamfer: 0.004 },
      { z: 0.165, y: 0.056, hw: 0.017, hh: 0.011, chamfer: 0.004 },
    ],
    "darkMetal",
  );
}

/**
 * 2. XR-24 Fırtına — M4A1-S Tactical AR-15 Carbine Archetype
 */
function buildCarbineM4(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  detail: WeaponDetailLevel,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const fp = detail === "fp";
  const tess = fp ? 14 : 8;
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  // Buffer tube + crane collapsible stock
  h.turned(
    "buffer-tube",
    [
      [-0.36, 0.019],
      [-0.14, 0.019],
    ],
    tess,
    0.018,
    0,
    "darkMetal",
  );
  h.loft(
    "stock",
    [
      { z: -0.43, y: -0.018, hw: 0.026, hh: 0.066, chamfer: 0.01 },
      { z: -0.35, y: -0.012, hw: 0.028, hh: 0.058, chamfer: 0.011 },
      { z: -0.24, y: 0.004, hw: 0.024, hh: 0.038, chamfer: 0.009 },
    ],
    "polymer",
    true,
  );
  h.loft(
    "buttpad",
    [
      { z: -0.442, y: -0.019, hw: 0.027, hh: 0.067, chamfer: 0.01 },
      { z: -0.428, y: -0.018, hw: 0.027, hh: 0.067, chamfer: 0.01 },
    ],
    "rubber",
  );

  // Sculpted AR-15 upper & lower receiver with flared magwell
  h.loft(
    "receiver",
    [
      { z: -0.14, y: 0.01, hw: 0.03, hh: 0.044, chamfer: 0.009, topSlope: 0.1 },
      { z: 0.02, y: 0.008, hw: 0.031, hh: 0.048, chamfer: 0.009, topSlope: 0.08 },
      { z: 0.135, y: 0.004, hw: 0.032, hh: 0.052, chamfer: 0.008, topSlope: 0.08 },
    ],
    "bluedSteel",
    true,
  );

  // Octagonal M-LOK / Quad-Rail free-float tactical handguard
  h.loft(
    "stock-handguard",
    [
      { z: 0.138, y: 0.018, hw: 0.029, hh: 0.031, chamfer: 0.012 },
      { z: 0.425, y: 0.018, hw: 0.028, hh: 0.03, chamfer: 0.012 },
    ],
    "bluedSteel",
    true,
  );

  // Full-length top Picatinny rail
  h.rail("top-rail", 0.056, -0.12, 0.41, 0.03, fp);

  // Turned carbine barrel + integral tactical suppressor (M4A1-S silhouette)
  h.turned(
    "barrel-core",
    [
      [0.42, 0.013],
      [0.52, 0.012],
      [0.535, 0.021],
      [0.725, 0.021],
      [0.74, 0.018],
    ],
    tess,
    0.018,
    0,
    "darkMetal",
    true,
  );

  // STANAG 30-round slightly curved tactical magazine
  h.curved(
    "magazine",
    [
      { z: 0.075, y: -0.03, halfW: 0.019, halfD: 0.034, chamfer: 0.005 },
      { z: 0.082, y: -0.115, halfW: 0.0185, halfD: 0.034, chamfer: 0.005 },
      { z: 0.104, y: -0.205, halfW: 0.019, halfD: 0.034, chamfer: 0.005 },
    ],
    "polymer",
    true,
  );

  // Swept MOE pistol grip + angled tactical vertical foregrip
  h.curved(
    "grip",
    [
      { z: -0.072, y: -0.032, halfW: 0.019, halfD: 0.026, chamfer: 0.008 },
      { z: -0.095, y: -0.098, halfW: 0.02, halfD: 0.027, chamfer: 0.009 },
      { z: -0.122, y: -0.16, halfW: 0.021, halfD: 0.029, chamfer: 0.008 },
    ],
    "rubber",
  );
  // Tactical vertical foregrip on lower rail
  h.turned(
    "foregrip",
    [
      [0.0, 0.014],
      [0.085, 0.016],
      [0.098, 0.012],
    ],
    Math.max(8, tess - 2),
    0,
    0,
    "rubber",
  );
  const fg = root.getChildMeshes().find((m) => m.name === prefix + "foregrip");
  if (fg instanceof Mesh) {
    fg.rotation.x = Math.PI / 2;
    fg.position.set(0, -0.012, 0.305);
    fg.bakeCurrentTransformIntoVertices();
  }

  // Trigger guard & trigger
  h.tube(
    "triggerguard",
    [
      new Vector3(0, -0.038, -0.055),
      new Vector3(0, -0.078, -0.035),
      new Vector3(0, -0.078, 0.02),
      new Vector3(0, -0.038, 0.035),
    ],
    0.0042,
    6,
    "darkMetal",
  );

  // Holographic reflex sight mounted on receiver rail
  h.loft(
    "optic-hood",
    [
      { z: -0.05, y: 0.092, hw: 0.028, hh: 0.028, chamfer: 0.008 },
      { z: 0.055, y: 0.092, hw: 0.028, hh: 0.028, chamfer: 0.008 },
    ],
    "darkMetal",
  );
  h.loft(
    "optic-lens",
    [
      { z: 0.05, y: 0.094, hw: 0.022, hh: 0.02, chamfer: 0.005 },
      { z: 0.059, y: 0.094, hw: 0.022, hh: 0.02, chamfer: 0.005 },
    ],
    "opticGlass",
  );
  if (fp) {
    // Glowing reflex red/green reticle dot + forward assist
    h.cyl("reticle-dot", 0.005, 0.005, 6, 0, 0.095, 0.01, "sightDot");
    h.cyl("forward-assist", 0.018, 0.036, 8, 0.032, 0.018, -0.065, "steel").rotation.z =
      Math.PI / 2;
  }
  // Flip-up front sight post
  h.loft(
    "front-sight",
    [
      { z: 0.39, y: 0.078, hw: 0.012, hh: 0.022, chamfer: 0.004 },
      { z: 0.415, y: 0.078, hw: 0.011, hh: 0.022, chamfer: 0.004 },
    ],
    "darkMetal",
  );
}

/**
 * 3. SM-35 Kıvılcım — MP5 Tactical Submachine Gun Archetype
 */
function buildSmgMP5(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  detail: WeaponDetailLevel,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const fp = detail === "fp";
  const tess = fp ? 14 : 8;
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  // Twin collapsible sliding stock rods + curved rubber buttpad
  for (const side of [-0.022, 0.022]) {
    h.turned(
      `stock-rod-${side > 0 ? "r" : "l"}`,
      [
        [-0.31, 0.0065],
        [-0.12, 0.0065],
      ],
      6,
      0.004,
      side,
      "steel",
    );
  }
  h.loft(
    "stock",
    [
      { z: -0.345, y: -0.008, hw: 0.028, hh: 0.056, chamfer: 0.012 },
      { z: -0.305, y: -0.004, hw: 0.028, hh: 0.05, chamfer: 0.011 },
    ],
    "rubber",
    true,
  );

  // Cylindrical-top stamped MP5 upper receiver + polymer trigger pack
  h.loft(
    "receiver",
    [
      { z: -0.135, y: 0.006, hw: 0.027, hh: 0.042, chamfer: 0.013, topSlope: 0.25 },
      { z: 0.145, y: 0.008, hw: 0.027, hh: 0.042, chamfer: 0.013, topSlope: 0.25 },
    ],
    "bluedSteel",
    true,
  );
  // Iconic tapered tropical polymer handguard
  h.loft(
    "stock-handguard",
    [
      { z: 0.145, y: 0.005, hw: 0.028, hh: 0.032, chamfer: 0.014, topSlope: 0.12 },
      { z: 0.28, y: 0.012, hw: 0.025, hh: 0.028, chamfer: 0.013, topSlope: 0.15 },
      { z: 0.36, y: 0.016, hw: 0.021, hh: 0.024, chamfer: 0.011 },
    ],
    "polymer",
    true,
  );
  // Upper cocking tube & left-side charging handle
  h.turned(
    "cocking-tube",
    [
      [0.14, 0.0135],
      [0.375, 0.0135],
    ],
    tess,
    0.037,
    0,
    "steel",
  );
  if (fp) {
    h.tube(
      "cocking-knob",
      [new Vector3(-0.014, 0.038, 0.305), new Vector3(-0.046, 0.044, 0.295)],
      0.0065,
      6,
      "rubber",
    );
  }

  // Short 3-lug barrel + compact flash hider
  h.turned(
    "barrel-core",
    [
      [0.34, 0.013],
      [0.44, 0.012],
      [0.455, 0.0155],
      [0.5, 0.0145],
    ],
    tess,
    0.014,
    0,
    "darkMetal",
    true,
  );

  // Curved 9mm stick magazine
  h.curved(
    "magazine",
    [
      { z: 0.085, y: -0.025, halfW: 0.014, halfD: 0.024, chamfer: 0.004 },
      { z: 0.102, y: -0.105, halfW: 0.014, halfD: 0.024, chamfer: 0.004 },
      { z: 0.136, y: -0.195, halfW: 0.014, halfD: 0.024, chamfer: 0.004 },
    ],
    "bluedSteel",
    true,
  );

  // Compact polymer pistol grip + trigger guard
  h.curved(
    "grip",
    [
      { z: -0.055, y: -0.026, halfW: 0.018, halfD: 0.024, chamfer: 0.008 },
      { z: -0.075, y: -0.088, halfW: 0.019, halfD: 0.025, chamfer: 0.008 },
      { z: -0.098, y: -0.142, halfW: 0.02, halfD: 0.026, chamfer: 0.008 },
    ],
    "rubber",
  );
  h.tube(
    "triggerguard",
    [
      new Vector3(0, -0.032, -0.04),
      new Vector3(0, -0.07, -0.022),
      new Vector3(0, -0.07, 0.025),
      new Vector3(0, -0.032, 0.036),
    ],
    0.004,
    6,
    "polymer",
  );

  // Iconic MP5 hooded ring front sight + rotary drum rear sight
  const frontHood = MeshBuilder.CreateTorus(
    prefix + "front-sight-hood",
    { diameter: 0.036, thickness: 0.0055, tessellation: fp ? 14 : 8 },
    scene,
  );
  frontHood.position.set(0, 0.054, 0.39);
  h.finalize(frontHood, "darkMetal");
  h.cyl("front-sight-post", 0.004, 0.018, 6, 0, 0.051, 0.39, "sightDot");
  h.cyl("rear-sight-drum", 0.024, 0.022, fp ? 12 : 8, 0, 0.058, -0.07, "darkMetal");
  h.rail("top-rail", 0.052, -0.04, 0.13, 0.024, fp);
}

/**
 * 4. SR-5 Ufuk — AWP / L96A1 Precision Bolt-Action Sniper Rifle Archetype
 */
function buildSniperAWP(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  detail: WeaponDetailLevel,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const fp = detail === "fp";
  const tess = fp ? 16 : 8;
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  // AWP precision thumbhole chassis: rear buttstock + cheek rest + upper & lower bridge
  h.loft(
    "stock",
    [
      { z: -0.46, y: -0.022, hw: 0.028, hh: 0.074, chamfer: 0.011 },
      { z: -0.37, y: -0.018, hw: 0.027, hh: 0.068, chamfer: 0.011 },
      { z: -0.31, y: -0.004, hw: 0.026, hh: 0.042, chamfer: 0.01 },
    ],
    "polymer",
    true,
  );
  // Adjustable cheekpiece atop stock
  h.loft(
    "cheekrest",
    [
      { z: -0.38, y: 0.044, hw: 0.024, hh: 0.016, chamfer: 0.011 },
      { z: -0.24, y: 0.044, hw: 0.024, hh: 0.016, chamfer: 0.011 },
    ],
    "rubber",
  );
  // Thumbhole upper bridge & lower strut
  h.loft(
    "stock-upper-bridge",
    [
      { z: -0.32, y: 0.016, hw: 0.023, hh: 0.02, chamfer: 0.008 },
      { z: -0.14, y: 0.012, hw: 0.026, hh: 0.024, chamfer: 0.008 },
    ],
    "polymer",
    true,
  );
  h.loft(
    "stock-lower-strut",
    [
      { z: -0.34, y: -0.076, hw: 0.018, hh: 0.014, chamfer: 0.006 },
      { z: -0.16, y: -0.095, hw: 0.019, hh: 0.016, chamfer: 0.006 },
    ],
    "polymer",
    true,
  );
  // Heavy flat-bottomed precision sniper chassis & forend
  h.loft(
    "receiver",
    [
      { z: -0.15, y: -0.004, hw: 0.032, hh: 0.044, chamfer: 0.01, topSlope: 0.14 },
      { z: 0.14, y: 0.0, hw: 0.032, hh: 0.044, chamfer: 0.01, topSlope: 0.14 },
      { z: 0.44, y: 0.002, hw: 0.028, hh: 0.034, chamfer: 0.01 },
      { z: 0.49, y: 0.005, hw: 0.024, hh: 0.026, chamfer: 0.009 },
    ],
    "polymer",
    true,
  );

  // Upper cylindrical bolt-action steel receiver
  h.turned(
    "bolt-action-housing",
    [
      [-0.12, 0.024],
      [0.14, 0.024],
    ],
    tess,
    0.032,
    0,
    "bluedSteel",
  );
  // Bent stainless steel bolt handle + tactical spherical bolt knob
  h.tube(
    "bolt-handle",
    [
      new Vector3(0.02, 0.032, -0.05),
      new Vector3(0.056, 0.028, -0.058),
      new Vector3(0.068, 0.002, -0.068),
    ],
    0.006,
    6,
    "chrome",
  );
  const knob = MeshBuilder.CreateSphere(
    prefix + "bolt-knob",
    { diameter: 0.026, segments: fp ? 10 : 6 },
    scene,
  );
  knob.position.set(0.071, -0.006, -0.071);
  h.finalize(knob, "darkMetal");

  // Extra-long free-floated heavy precision barrel
  h.turned(
    "barrel-core",
    [
      [0.14, 0.021],
      [0.48, 0.0185],
      [0.86, 0.015],
      [0.88, 0.0165],
    ],
    tess,
    0.03,
    0,
    "steel",
    true,
  );
  // Iconic dual-chamber AWP rectangular beveled muzzle brake
  h.loft(
    "muzzle-brake",
    [
      { z: 0.875, y: 0.03, hw: 0.022, hh: 0.019, chamfer: 0.006 },
      { z: 0.96, y: 0.03, hw: 0.023, hh: 0.02, chamfer: 0.006 },
    ],
    "darkMetal",
  );

  // Recessed precision box sniper magazine
  h.loft(
    "magazine",
    [
      { z: 0.005, y: -0.065, hw: 0.018, hh: 0.05, chamfer: 0.005 },
      { z: 0.11, y: -0.065, hw: 0.018, hh: 0.05, chamfer: 0.005 },
    ],
    "darkMetal",
    true,
  );

  // Pistol grip inside thumbhole + trigger guard
  h.curved(
    "grip",
    [
      { z: -0.105, y: -0.03, halfW: 0.019, halfD: 0.025, chamfer: 0.008 },
      { z: -0.13, y: -0.085, halfW: 0.02, halfD: 0.026, chamfer: 0.008 },
      { z: -0.155, y: -0.125, halfW: 0.021, halfD: 0.027, chamfer: 0.008 },
    ],
    "rubber",
  );
  h.tube(
    "triggerguard",
    [
      new Vector3(0, -0.038, -0.095),
      new Vector3(0, -0.076, -0.075),
      new Vector3(0, -0.076, -0.02),
      new Vector3(0, -0.038, -0.008),
    ],
    0.0045,
    6,
    "darkMetal",
  );

  // Folded under-forend tactical bipod
  for (const side of [-0.026, 0.026]) {
    h.tube(
      `bipod-${side > 0 ? "r" : "l"}`,
      [new Vector3(side * 0.6, -0.022, 0.45), new Vector3(side, -0.034, 0.24)],
      0.0065,
      6,
      "darkMetal",
    );
  }

  // Multi-stage lathed telescopic sniper scope + dual scope rings + turrets + sapphire lenses
  h.rail("scope-rail", 0.056, -0.11, 0.14, 0.026, fp);
  for (const rz of [-0.06, 0.085]) {
    h.loft(
      `scope-ring-${rz > 0 ? "f" : "r"}`,
      [
        { z: rz - 0.014, y: 0.086, hw: 0.024, hh: 0.032, chamfer: 0.009 },
        { z: rz + 0.014, y: 0.086, hw: 0.024, hh: 0.032, chamfer: 0.009 },
      ],
      "darkMetal",
    );
  }
  h.turned(
    "scope-tube",
    [
      [-0.215, 0.026],
      [-0.145, 0.026],
      [-0.115, 0.0185],
      [0.12, 0.0185],
      [0.165, 0.031],
      [0.265, 0.032],
    ],
    tess,
    0.106,
    0,
    "bluedSteel",
  );
  // Elevation & windage adjustment turrets
  h.cyl("scope-turret-top", 0.02, 0.024, 8, 0, 0.132, 0.01, "darkMetal");
  h.cyl("scope-turret-side", 0.019, 0.024, 8, 0.025, 0.106, 0.01, "darkMetal").rotation.z =
    Math.PI / 2;
  // Objective & ocular anti-reflective sapphire lenses
  h.turned(
    "scope-lens-front",
    [
      [0.258, 0.027],
      [0.267, 0.027],
    ],
    tess,
    0.106,
    0,
    "opticGlass",
  );
  h.turned(
    "scope-lens-rear",
    [
      [-0.217, 0.021],
      [-0.21, 0.021],
    ],
    tess,
    0.106,
    0,
    "opticGlass",
  );
}

/**
 * 5. SG-6 Yarma — M870 / Nova Tactical Pump-Action Shotgun Archetype
 */
function buildShotgunM870(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  detail: WeaponDetailLevel,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const fp = detail === "fp";
  const tess = fp ? 14 : 8;
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  // Classic curved-comb shotgun stock + semi-pistol grip wrist
  h.loft(
    "stock",
    [
      { z: -0.45, y: -0.056, hw: 0.026, hh: 0.072, chamfer: 0.012 },
      { z: -0.34, y: -0.044, hw: 0.025, hh: 0.056, chamfer: 0.011 },
      { z: -0.22, y: -0.032, hw: 0.021, hh: 0.032, chamfer: 0.01 },
      { z: -0.145, y: -0.018, hw: 0.023, hh: 0.034, chamfer: 0.009 },
    ],
    "wood",
    true,
  );
  h.loft(
    "buttpad",
    [
      { z: -0.466, y: -0.057, hw: 0.027, hh: 0.073, chamfer: 0.012 },
      { z: -0.448, y: -0.056, hw: 0.027, hh: 0.073, chamfer: 0.012 },
    ],
    "rubber",
  );

  // Rounded-top heavy steel shotgun receiver
  h.loft(
    "receiver",
    [
      { z: -0.148, y: 0.008, hw: 0.029, hh: 0.044, chamfer: 0.013, topSlope: 0.22 },
      { z: 0.145, y: 0.012, hw: 0.03, hh: 0.045, chamfer: 0.013, topSlope: 0.22 },
    ],
    "bluedSteel",
    true,
  );
  // Polished steel bolt visible through right-side ejection port
  if (fp) {
    const bolt = h.loft(
      "bolt-face",
      [
        { z: -0.02, y: 0.022, hw: 0.007, hh: 0.015, chamfer: 0.003 },
        { z: 0.09, y: 0.022, hw: 0.007, hh: 0.015, chamfer: 0.003 },
      ],
      "chrome",
    );
    bolt.position.x = 0.027;
  }

  // Heavy 12-gauge barrel + ventilated top rib
  h.turned(
    "barrel-core",
    [
      [0.14, 0.018],
      [0.74, 0.0165],
      [0.76, 0.0185],
    ],
    tess,
    0.032,
    0,
    "steel",
    true,
  );
  // Under-barrel tubular magazine + knurled end cap + barrel clamp
  h.turned(
    "mag-tube",
    [
      [0.14, 0.0155],
      [0.64, 0.0155],
      [0.66, 0.017],
      [0.675, 0.014],
    ],
    tess,
    -0.006,
    0,
    "darkMetal",
  );
  h.loft(
    "barrel-clamp",
    [
      { z: 0.57, y: 0.013, hw: 0.018, hh: 0.035, chamfer: 0.006 },
      { z: 0.60, y: 0.013, hw: 0.018, hh: 0.035, chamfer: 0.006 },
    ],
    "darkMetal",
  );

  // Iconic ribbed cylindrical pump-action forend sliding on magazine tube
  h.turned(
    "pump",
    [
      [0.24, 0.024],
      [0.255, 0.0285],
      [0.275, 0.0255],
      [0.295, 0.029],
      [0.315, 0.0255],
      [0.335, 0.029],
      [0.355, 0.0255],
      [0.375, 0.029],
      [0.395, 0.0255],
      [0.415, 0.029],
      [0.435, 0.028],
      [0.455, 0.022],
    ],
    tess,
    -0.006,
    0,
    "wood",
    true,
  );

  // Trigger guard & curved trigger
  h.tube(
    "triggerguard",
    [
      new Vector3(0, -0.03, -0.105),
      new Vector3(0, -0.072, -0.088),
      new Vector3(0, -0.072, -0.03),
      new Vector3(0, -0.03, -0.018),
    ],
    0.0045,
    6,
    "darkMetal",
  );

  // Side-saddle 4-shell carrier on left side of receiver (distinctive tactical shotgun read!)
  if (fp) {
    h.loft(
      "shell-carrier",
      [
        { z: -0.06, y: 0.008, hw: 0.006, hh: 0.028, chamfer: 0.002 },
        { z: 0.095, y: 0.008, hw: 0.006, hh: 0.028, chamfer: 0.002 },
      ],
      "polymer",
    ).position.x = -0.033;
    for (let i = 0; i < 4; i++) {
      const sz = -0.038 + i * 0.036;
      h.cyl(`shell-hull-${i}`, 0.02, 0.048, 8, -0.042, 0.004, sz, "shellRed");
      h.cyl(`shell-brass-${i}`, 0.021, 0.014, 8, -0.042, 0.032, sz, "brass");
    }
  }

  // Ghost-ring rear sight & fiber-optic front bead
  const ghostRing = MeshBuilder.CreateTorus(
    prefix + "rear-sight",
    { diameter: 0.026, thickness: 0.005, tessellation: fp ? 12 : 8 },
    scene,
  );
  ghostRing.position.set(0, 0.068, -0.08);
  h.finalize(ghostRing, "darkMetal");
  h.cyl("front-sight-bead", 0.008, 0.014, 6, 0, 0.056, 0.735, "sightDot");
}

/**
 * 6. P-12 İz — USP-S / Glock-19 Tactical Sidearm Archetype
 */
function buildPistolTactical(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  detail: WeaponDetailLevel,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const fp = detail === "fp";
  const tess = fp ? 12 : 8;
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  // Machined beveled steel pistol slide (primary skinnable surface)
  h.loft(
    "receiver",
    [
      { z: -0.105, y: 0.034, hw: 0.022, hh: 0.024, chamfer: 0.007, topSlope: 0.16 },
      { z: 0.195, y: 0.034, hw: 0.022, hh: 0.024, chamfer: 0.007, topSlope: 0.16 },
      { z: 0.215, y: 0.033, hw: 0.02, hh: 0.022, chamfer: 0.007, topSlope: 0.18 },
    ],
    "bluedSteel",
    true,
  );

  // Stainless steel chamber hood & crowned barrel tip
  h.loft(
    "ejection-port",
    [
      { z: 0.015, y: 0.046, hw: 0.015, hh: 0.011, chamfer: 0.004 },
      { z: 0.08, y: 0.046, hw: 0.015, hh: 0.011, chamfer: 0.004 },
    ],
    "chrome",
  );
  h.turned(
    "barrel-muzzle",
    [
      [0.19, 0.0105],
      [0.235, 0.0105],
    ],
    tess,
    0.034,
    0,
    "chrome",
    true,
  );

  // Rear slide cocking serrations
  if (fp) {
    for (let i = 0; i < 4; i++) {
      const sz = -0.09 + i * 0.012;
      h.loft(
        `serration-${i}`,
        [
          { z: sz, y: 0.033, hw: 0.0232, hh: 0.016, chamfer: 0.002 },
          { z: sz + 0.0045, y: 0.033, hw: 0.0232, hh: 0.016, chamfer: 0.002 },
        ],
        "darkMetal",
      );
    }
  }

  // Ergonomic polymer frame & under-barrel dust cover with accessory rail
  h.loft(
    "frame",
    [
      { z: -0.105, y: 0.004, hw: 0.021, hh: 0.016, chamfer: 0.006 },
      { z: 0.195, y: 0.004, hw: 0.02, hh: 0.014, chamfer: 0.006 },
    ],
    "polymer",
  );

  // Properly angled 19-degree checkered ergonomic pistol grip
  h.curved(
    "grip",
    [
      { z: -0.052, y: -0.006, halfW: 0.02, halfD: 0.032, chamfer: 0.009 },
      { z: -0.072, y: -0.068, halfW: 0.021, halfD: 0.033, chamfer: 0.009 },
      { z: -0.096, y: -0.132, halfW: 0.022, halfD: 0.034, chamfer: 0.008 },
    ],
    "rubber",
  );
  // Flared magazine floorplate protruding cleanly from grip heel
  h.loft(
    "magazine",
    [
      { z: -0.132, y: -0.145, hw: 0.023, hh: 0.012, chamfer: 0.005 },
      { z: -0.064, y: -0.145, hw: 0.023, hh: 0.012, chamfer: 0.005 },
    ],
    "darkMetal",
    true,
  );

  // Squared tactical trigger guard & curved trigger
  h.tube(
    "triggerguard",
    [
      new Vector3(0, -0.006, -0.02),
      new Vector3(0, -0.056, -0.006),
      new Vector3(0, -0.056, 0.062),
      new Vector3(0, -0.006, 0.072),
    ],
    0.0048,
    6,
    "polymer",
  );
  if (fp) {
    h.tube(
      "trigger",
      [new Vector3(0, -0.008, 0.025), new Vector3(0, -0.04, 0.014)],
      0.0042,
      6,
      "steel",
    );
  }

  // 3-dot tritium combat iron sights
  h.loft(
    "front-sight",
    [
      { z: 0.185, y: 0.064, hw: 0.005, hh: 0.009, chamfer: 0.0015 },
      { z: 0.205, y: 0.064, hw: 0.005, hh: 0.009, chamfer: 0.0015 },
    ],
    "darkMetal",
  );
  h.cyl("front-dot", 0.0045, 0.004, 6, 0, 0.066, 0.184, "sightDot");
  for (const sx of [-0.012, 0.012]) {
    h.loft(
      `rear-sight-${sx > 0 ? "r" : "l"}`,
      [
        { z: -0.098, y: 0.064, hw: 0.006, hh: 0.009, chamfer: 0.0015 },
        { z: -0.078, y: 0.064, hw: 0.006, hh: 0.009, chamfer: 0.0015 },
      ],
      "darkMetal",
    ).position.x = sx;
    if (fp) {
      h.cyl(`rear-dot-${sx > 0 ? "r" : "l"}`, 0.004, 0.004, 6, sx, 0.065, -0.099, "sightDot");
    }
  }
}

/**
 * 7. MG-60 Kalkan — M249 SAW / Negev Light Machine Gun Archetype
 */
function buildLmgM249(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  detail: WeaponDetailLevel,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const fp = detail === "fp";
  const tess = fp ? 14 : 8;
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  // Heavy support tubular/skeletonized machine gun stock
  h.loft(
    "stock",
    [
      { z: -0.45, y: -0.015, hw: 0.032, hh: 0.074, chamfer: 0.012 },
      { z: -0.35, y: -0.01, hw: 0.03, hh: 0.056, chamfer: 0.011 },
      { z: -0.18, y: 0.008, hw: 0.028, hh: 0.038, chamfer: 0.01 },
    ],
    "polymer",
    true,
  );
  h.loft(
    "buttpad",
    [
      { z: -0.464, y: -0.016, hw: 0.033, hh: 0.075, chamfer: 0.012 },
      { z: -0.448, y: -0.015, hw: 0.033, hh: 0.075, chamfer: 0.012 },
    ],
    "rubber",
  );

  // Wide heavy machine gun receiver + hinged top feed tray cover
  h.loft(
    "receiver",
    [
      { z: -0.18, y: 0.006, hw: 0.044, hh: 0.054, chamfer: 0.011, topSlope: 0.08 },
      { z: 0.22, y: 0.008, hw: 0.044, hh: 0.056, chamfer: 0.011, topSlope: 0.08 },
      { z: 0.42, y: 0.004, hw: 0.036, hh: 0.044, chamfer: 0.012 },
    ],
    "bluedSteel",
    true,
  );
  h.rail("top-rail", 0.068, -0.13, 0.22, 0.036, fp);

  // Perforated heat-shield barrel shroud + heavy quick-change barrel + conical flash hider
  h.turned(
    "heat-shroud",
    [
      [0.22, 0.03],
      [0.54, 0.028],
    ],
    tess,
    0.028,
    0,
    "darkMetal",
  );
  h.turned(
    "barrel-core",
    [
      [0.52, 0.017],
      [0.72, 0.0155],
      [0.74, 0.021],
      [0.79, 0.018],
    ],
    tess,
    0.028,
    0,
    "steel",
    true,
  );
  // Lower gas regulator cylinder
  h.turned(
    "gas-cylinder",
    [
      [0.36, 0.014],
      [0.58, 0.014],
    ],
    Math.max(8, tess - 2),
    -0.012,
    0,
    "darkMetal",
  );

  // Large 100-round contoured ammo box magazine underneath receiver
  h.loft(
    "magazine",
    [
      { z: -0.02, y: -0.115, hw: 0.058, hh: 0.072, chamfer: 0.014 },
      { z: 0.16, y: -0.115, hw: 0.058, hh: 0.072, chamfer: 0.014 },
    ],
    "polymer",
    true,
  );
  // Linked brass ammunition belt feeding from box into left side of feed tray!
  if (fp) {
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const by = -0.055 + t * 0.078;
      const bx = -0.062 + Math.sin(t * Math.PI) * -0.014 + t * 0.018;
      const cart = h.cyl(`belt-round-${i}`, 0.011, 0.044, 6, bx, by, 0.065, "brass");
      cart.rotation.x = Math.PI / 2;
    }
  }

  // Folding tubular carry handle over barrel shroud
  h.tube(
    "carry-handle",
    [
      new Vector3(0.028, 0.052, 0.25),
      new Vector3(0.055, 0.095, 0.28),
      new Vector3(0.055, 0.098, 0.42),
      new Vector3(0.026, 0.052, 0.45),
    ],
    0.007,
    6,
    "darkMetal",
  );

  // Folded heavy bipod legs
  for (const side of [-0.036, 0.036]) {
    h.tube(
      `bipod-${side > 0 ? "r" : "l"}`,
      [new Vector3(side * 0.6, -0.025, 0.56), new Vector3(side, -0.042, 0.28)],
      0.0075,
      6,
      "steel",
    );
  }

  // Heavy grip & winter trigger guard
  h.curved(
    "grip",
    [
      { z: -0.12, y: -0.038, halfW: 0.021, halfD: 0.028, chamfer: 0.009 },
      { z: -0.145, y: -0.105, halfW: 0.022, halfD: 0.029, chamfer: 0.009 },
      { z: -0.17, y: -0.168, halfW: 0.023, halfD: 0.03, chamfer: 0.008 },
    ],
    "rubber",
  );
  h.tube(
    "triggerguard",
    [
      new Vector3(0, -0.042, -0.102),
      new Vector3(0, -0.088, -0.085),
      new Vector3(0, -0.088, -0.03),
      new Vector3(0, -0.042, -0.018),
    ],
    0.005,
    6,
    "darkMetal",
  );
  // Front sight post
  h.loft(
    "front-sight",
    [
      { z: 0.66, y: 0.06, hw: 0.014, hh: 0.028, chamfer: 0.004 },
      { z: 0.69, y: 0.06, hw: 0.013, hh: 0.028, chamfer: 0.004 },
    ],
    "darkMetal",
  );
  h.cyl("front-dot", 0.0055, 0.018, 6, 0, 0.074, 0.675, "sightDot");
}

/**
 * 8. RX-3 Şimşek — Industrial Military Precision Electromagnetic Rail Sniper
 */
function buildRailgunRX3(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  detail: WeaponDetailLevel,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
) {
  const fp = detail === "fp";
  const tess = fp ? 14 : 8;
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  // Sculpted angular industrial chassis stock with adjustable cheek rest
  h.loft(
    "stock",
    [
      { z: -0.44, y: -0.018, hw: 0.03, hh: 0.072, chamfer: 0.012 },
      { z: -0.32, y: -0.01, hw: 0.029, hh: 0.056, chamfer: 0.011 },
      { z: -0.16, y: 0.002, hw: 0.033, hh: 0.046, chamfer: 0.011 },
    ],
    "polymer",
    true,
  );
  h.loft(
    "cheekrest",
    [
      { z: -0.38, y: 0.048, hw: 0.024, hh: 0.014, chamfer: 0.009 },
      { z: -0.22, y: 0.048, hw: 0.024, hh: 0.014, chamfer: 0.009 },
    ],
    "rubber",
  );

  // Heavy chamfered capacitor receiver housing
  h.loft(
    "receiver",
    [
      { z: -0.16, y: 0.006, hw: 0.038, hh: 0.054, chamfer: 0.014, topSlope: 0.14 },
      { z: 0.24, y: 0.008, hw: 0.04, hh: 0.056, chamfer: 0.015, topSlope: 0.14 },
      { z: 0.34, y: 0.008, hw: 0.034, hh: 0.048, chamfer: 0.013 },
    ],
    "bluedSteel",
    true,
  );

  // Dual parallel precision accelerator rails (upper + lower) with open plasma channel
  h.loft(
    "barrel-rail-top",
    [
      { z: 0.32, y: 0.042, hw: 0.024, hh: 0.014, chamfer: 0.006 },
      { z: 0.91, y: 0.042, hw: 0.02, hh: 0.012, chamfer: 0.005 },
    ],
    "steel",
    true,
  );
  h.loft(
    "barrel-rail-bot",
    [
      { z: 0.32, y: -0.006, hw: 0.024, hh: 0.014, chamfer: 0.006 },
      { z: 0.88, y: -0.006, hw: 0.02, hh: 0.012, chamfer: 0.005 },
    ],
    "steel",
    true,
  );

  // Glowing electromagnetic plasma conduit core between the dual rails
  h.turned(
    "core-conduit",
    [
      [0.24, 0.0075],
      [0.86, 0.006],
    ],
    Math.max(8, tess - 2),
    0.018,
    0,
    "railGlow",
  );

  // 4 machined copper/dark-steel accelerator coil clamps bridging the rails
  const coilPositions = fp ? [0.42, 0.56, 0.70, 0.83] : [0.46, 0.74];
  coilPositions.forEach((cz, idx) => {
    h.loft(
      `coil-clamp-${idx}`,
      [
        { z: cz - 0.018, y: 0.018, hw: 0.028, hh: 0.042, chamfer: 0.009 },
        { z: cz + 0.018, y: 0.018, hw: 0.028, hh: 0.042, chamfer: 0.009 },
      ],
      "darkMetal",
    );
    h.loft(
      `coil-copper-${idx}`,
      [
        { z: cz - 0.007, y: 0.018, hw: 0.0305, hh: 0.032, chamfer: 0.006 },
        { z: cz + 0.007, y: 0.018, hw: 0.0305, hh: 0.032, chamfer: 0.006 },
      ],
      "brass",
    );
  });

  // Recessed angled energy cell magazine
  h.curved(
    "magazine",
    [
      { z: 0.05, y: -0.04, halfW: 0.024, halfD: 0.042, chamfer: 0.007 },
      { z: 0.07, y: -0.125, halfW: 0.023, halfD: 0.04, chamfer: 0.007 },
    ],
    "darkMetal",
    true,
  );

  // Precision digital rail optic mounted on beveled riser
  h.loft(
    "optic-riser",
    [
      { z: -0.1, y: 0.078, hw: 0.02, hh: 0.018, chamfer: 0.006 },
      { z: 0.14, y: 0.078, hw: 0.02, hh: 0.018, chamfer: 0.006 },
    ],
    "darkMetal",
  );
  h.loft(
    "optic-housing",
    [
      { z: -0.16, y: 0.112, hw: 0.028, hh: 0.028, chamfer: 0.01 },
      { z: 0.21, y: 0.112, hw: 0.03, hh: 0.03, chamfer: 0.01 },
    ],
    "bluedSteel",
  );
  h.loft(
    "optic-lens",
    [
      { z: 0.205, y: 0.112, hw: 0.023, hh: 0.022, chamfer: 0.006 },
      { z: 0.216, y: 0.112, hw: 0.023, hh: 0.022, chamfer: 0.006 },
    ],
    "opticGlass",
  );

  // Pistol grip & guard
  h.curved(
    "grip",
    [
      { z: -0.09, y: -0.038, halfW: 0.02, halfD: 0.028, chamfer: 0.008 },
      { z: -0.115, y: -0.102, halfW: 0.021, halfD: 0.029, chamfer: 0.009 },
      { z: -0.14, y: -0.162, halfW: 0.022, halfD: 0.03, chamfer: 0.008 },
    ],
    "rubber",
  );
  h.tube(
    "triggerguard",
    [
      new Vector3(0, -0.044, -0.07),
      new Vector3(0, -0.084, -0.052),
      new Vector3(0, -0.084, 0.005),
      new Vector3(0, -0.044, 0.018),
    ],
    0.0045,
    6,
    "darkMetal",
  );
}

/**
 * Builds sculpted straight tactical knives (default M9 Combat Knife + Japanese Tanto)
 * with true beveled hollow-ground blades, clip/chisel points, contoured handles, and guards.
 * Preserves exact knifeStyle/knifePart metadata for renderer animations & tests.
 */
export function buildSculptedStraightKnives(
  scene: Scene,
  root: TransformNode,
  prefix: string,
  quality: WeaponQualityTier,
  renderingGroupId?: number,
  includeGloves = true,
  onlyStyle?: "default" | "tanto",
): void {
  const h = makePartHelper(scene, root, prefix, quality, renderingGroupId);

  if (!onlyStyle || onlyStyle === "default") {
    const metaHandle = { knifeStyle: "default", knifePart: "handle" };
    const metaBlade = { knifeStyle: "default", knifePart: "blade" };

    // Contoured ribbed oval tactical combat handle + steel pommel
    h.loft(
      "default-handle",
      [
        { z: -0.215, y: -0.024, hw: 0.021, hh: 0.028, chamfer: 0.011 },
        { z: -0.16, y: -0.02, hw: 0.025, hh: 0.034, chamfer: 0.013 },
        { z: -0.09, y: -0.016, hw: 0.026, hh: 0.035, chamfer: 0.014 },
        { z: -0.015, y: -0.012, hw: 0.022, hh: 0.03, chamfer: 0.011 },
      ],
      "rubber",
      false,
      2.6,
      metaHandle,
    );
    h.loft(
      "default-pommel",
      [
        { z: -0.238, y: -0.025, hw: 0.024, hh: 0.032, chamfer: 0.01 },
        { z: -0.214, y: -0.024, hw: 0.023, hh: 0.03, chamfer: 0.01 },
      ],
      "steel",
      false,
      2.6,
      metaHandle,
    );
    // Curved double-quillon steel crossguard
    h.loft(
      "default-guard",
      [
        { z: -0.016, y: -0.008, hw: 0.018, hh: 0.068, chamfer: 0.008 },
        { z: 0.014, y: -0.006, hw: 0.018, hh: 0.064, chamfer: 0.008 },
      ],
      "bluedSteel",
      false,
      2.6,
      metaHandle,
    );
    // Hollow-ground clip-point M9 combat blade
    const blade = buildSculptedBlade(scene, prefix + "default-blade", [
      { z: 0.014, spineY: 0.032, edgeY: -0.03, halfThick: 0.0085 },
      { z: 0.14, spineY: 0.033, edgeY: -0.03, halfThick: 0.008 },
      { z: 0.25, spineY: 0.031, edgeY: -0.026, halfThick: 0.0072 },
      { z: 0.315, spineY: 0.016, edgeY: -0.015, halfThick: 0.005 },
      { z: 0.365, spineY: 0.006, edgeY: 0.003, halfThick: 0.0012 },
    ]);
    h.finalize(blade, "chrome", true, metaBlade);
  }

  if (!onlyStyle || onlyStyle === "tanto") {
    const metaHandle = { knifeStyle: "tanto", knifePart: "handle" };
    const metaBlade = { knifeStyle: "tanto", knifePart: "blade" };

    // Traditional wrapped oval tsuka handle + metal kashira pommel
    h.loft(
      "tanto-tsuka",
      [
        { z: -0.22, y: 0.004, hw: 0.018, hh: 0.027, chamfer: 0.009 },
        { z: -0.11, y: 0.006, hw: 0.02, hh: 0.029, chamfer: 0.01 },
        { z: -0.005, y: 0.008, hw: 0.019, hh: 0.028, chamfer: 0.009 },
      ],
      "leather",
      false,
      2.8,
      metaHandle,
    );
    // Oval Japanese tsuba guard + brass habaki blade collar
    h.loft(
      "tanto-tsuba",
      [
        { z: -0.006, y: 0.008, hw: 0.034, hh: 0.046, chamfer: 0.015 },
        { z: 0.01, y: 0.008, hw: 0.034, hh: 0.046, chamfer: 0.015 },
      ],
      "darkMetal",
      false,
      2.6,
      metaHandle,
    );
    h.loft(
      "tanto-habaki",
      [
        { z: 0.01, y: 0.009, hw: 0.013, hh: 0.026, chamfer: 0.005 },
        { z: 0.042, y: 0.009, hw: 0.012, hh: 0.025, chamfer: 0.005 },
      ],
      "brass",
      false,
      2.6,
      metaHandle,
    );
    // Crisp angular chisel-point Tanto blade with yokote transition
    const tantoBlade = buildSculptedBlade(scene, prefix + "tanto-blade", [
      { z: 0.042, spineY: 0.034, edgeY: -0.02, halfThick: 0.0082 },
      { z: 0.16, spineY: 0.035, edgeY: -0.019, halfThick: 0.0078 },
      { z: 0.275, spineY: 0.036, edgeY: -0.016, halfThick: 0.007 },
      { z: 0.345, spineY: 0.036, edgeY: 0.012, halfThick: 0.0045 },
      { z: 0.375, spineY: 0.035, edgeY: 0.032, halfThick: 0.0012 },
    ]);
    h.finalize(tantoBlade, "chrome", true, metaBlade);
  }

  // Sculpted articulated gloved hand for FP straight knives
  if (includeGloves) {
    const styles: Array<"default" | "tanto"> = onlyStyle ? [onlyStyle] : ["default", "tanto"];
    for (const style of styles) {
      const meta = { knifeStyle: style, knifePart: "handle" };
      const palm = h.loft(
        `${style}-palm`,
        [
          { z: -0.2, y: -0.038, hw: 0.042, hh: 0.038, chamfer: 0.018 },
          { z: -0.06, y: -0.028, hw: 0.046, hh: 0.04, chamfer: 0.02 },
        ],
        "glove",
        false,
        2.5,
        meta,
      );
      palm.position.x = 0.022;
      const cuff = h.loft(
        `${style}-wrist`,
        [
          { z: -0.35, y: -0.064, hw: 0.045, hh: 0.044, chamfer: 0.02 },
          { z: -0.19, y: -0.044, hw: 0.042, hh: 0.04, chamfer: 0.018 },
        ],
        "gloveAccent",
        false,
        2.5,
        meta,
      );
      cuff.position.x = 0.035;
      for (let f = 0; f < 4; f++) {
        const finger = h.tube(
          `${style}-finger-${f}`,
          [
            new Vector3(0.028, -0.048, -0.175 + f * 0.034),
            new Vector3(-0.022, -0.036, -0.172 + f * 0.034),
            new Vector3(-0.028, -0.002, -0.168 + f * 0.034),
          ],
          0.0155,
          7,
          "glove",
          false,
          meta,
        );
        finger.isPickable = false;
      }
      h.tube(
        `${style}-thumb`,
        [
          new Vector3(0.044, -0.02, -0.13),
          new Vector3(0.048, 0.008, -0.085),
          new Vector3(0.028, 0.022, -0.045),
        ],
        0.0165,
        7,
        "glove",
        false,
        meta,
      );
    }
  }
}

/**
 * Standalone sculpted Karambit & Butterfly (Balisong) 3D models for 3D Inventory Preview,
 * third-person remote players, and dropped world display (FP continues using hinged knifeRig.ts).
 */
export function buildStandaloneSpecialKnife(
  scene: Scene,
  root: TransformNode,
  style: "karambit" | "butterfly",
  prefix: string,
  quality: WeaponQualityTier,
): void {
  const h = makePartHelper(scene, root, prefix, quality);
  const metaHandle = { knifeStyle: style, knifePart: "handle" };
  const metaBlade = { knifeStyle: style, knifePart: "blade" };

  if (style === "karambit") {
    // Retention finger ring
    const ring = MeshBuilder.CreateTorus(
      prefix + "karambit-ring",
      { diameter: 0.072, thickness: 0.014, tessellation: 18 },
      scene,
    );
    ring.position.set(0, -0.006, -0.155);
    ring.rotation.y = Math.PI / 2;
    h.finalize(ring, "darkMetal", false, metaHandle);

    // Ergonomic arched karambit handle
    h.curved(
      "karambit-handle",
      [
        { z: -0.12, y: -0.005, halfW: 0.016, halfD: 0.022, chamfer: 0.007 },
        { z: -0.055, y: 0.008, halfW: 0.017, halfD: 0.025, chamfer: 0.008 },
        { z: 0.015, y: 0.014, halfW: 0.016, halfD: 0.024, chamfer: 0.007 },
      ],
      "rubber",
      false,
      metaHandle,
    );
    // Iconic curved talon / hawkbill beveled blade
    const claw = buildSculptedBlade(scene, prefix + "karambit-blade", [
      { z: 0.015, spineY: 0.036, edgeY: -0.012, halfThick: 0.0075 },
      { z: 0.08, spineY: 0.044, edgeY: -0.002, halfThick: 0.007 },
      { z: 0.145, spineY: 0.034, edgeY: -0.004, halfThick: 0.006 },
      { z: 0.2, spineY: 0.006, edgeY: -0.024, halfThick: 0.0042 },
      { z: 0.238, spineY: -0.042, edgeY: -0.046, halfThick: 0.0012 },
    ]);
    h.finalize(claw, "chrome", true, metaBlade);
  } else {
    // Butterfly (Balisong): Dual contoured skeletonized handles + pivot pins + latch + clip-point blade
    for (const [label, yOff] of [
      ["safe", 0.022],
      ["bite", -0.022],
    ] as const) {
      h.loft(
        `butterfly-handle-${label}`,
        [
          { z: -0.22, y: yOff, hw: 0.013, hh: 0.014, chamfer: 0.005 },
          { z: -0.01, y: yOff * 0.85, hw: 0.013, hh: 0.014, chamfer: 0.005 },
        ],
        label === "safe" ? "bluedSteel" : "darkMetal",
        false,
        2.6,
        metaHandle,
      );
      const pin = h.cyl(`butterfly-pin-${label}`, 0.01, 0.032, 8, 0, yOff * 0.85, -0.018, "chrome", false, metaHandle);
      pin.rotation.z = Math.PI / 2;
    }
    const blade = buildSculptedBlade(scene, prefix + "butterfly-blade", [
      { z: -0.01, spineY: 0.022, edgeY: -0.022, halfThick: 0.007 },
      { z: 0.11, spineY: 0.026, edgeY: -0.022, halfThick: 0.0068 },
      { z: 0.21, spineY: 0.02, edgeY: -0.018, halfThick: 0.0055 },
      { z: 0.275, spineY: 0.002, edgeY: -0.002, halfThick: 0.0012 },
    ]);
    h.finalize(blade, "chrome", true, metaBlade);
  }
}

/**
 * Unified sculpted 3D weapon builder used across:
 * 1. First-person viewmodels (renderer.ts)
 * 2. Third-person remote players (remoteWeapon.ts)
 * 3. Physical dropped ground weapons (renderer.ts)
 * 4. Interactive 3D Inventory & Skin Preview (weaponPreview3D.ts)
 */
export function buildWeaponModel(
  scene: Scene,
  weaponId: WeaponId,
  options: WeaponBuildOptions,
): TransformNode {
  const quality = options.quality ?? "high";
  const prefix = options.prefix ?? `${weaponId}-`;
  const root = new TransformNode(options.prefix ? `${options.prefix}root` : weaponId, scene);

  switch (weaponId) {
    case "rifle":
      buildRifleAK(scene, root, prefix, options.detail, quality, options.renderingGroupId);
      break;
    case "carbine":
      buildCarbineM4(scene, root, prefix, options.detail, quality, options.renderingGroupId);
      break;
    case "smg":
      buildSmgMP5(scene, root, prefix, options.detail, quality, options.renderingGroupId);
      break;
    case "sniper":
      buildSniperAWP(scene, root, prefix, options.detail, quality, options.renderingGroupId);
      break;
    case "shotgun":
      buildShotgunM870(scene, root, prefix, options.detail, quality, options.renderingGroupId);
      break;
    case "pistol":
      buildPistolTactical(scene, root, prefix, options.detail, quality, options.renderingGroupId);
      break;
    case "lmg":
      buildLmgM249(scene, root, prefix, options.detail, quality, options.renderingGroupId);
      break;
    case "railgun":
      buildRailgunRX3(scene, root, prefix, options.detail, quality, options.renderingGroupId);
      break;
    case "knife": {
      const style = options.knifeStyle ?? "default";
      if (style === "karambit" || style === "butterfly") {
        buildStandaloneSpecialKnife(scene, root, style, prefix, quality);
      } else {
        buildSculptedStraightKnives(
          scene,
          root,
          prefix,
          quality,
          options.renderingGroupId,
          options.detail === "fp",
          style,
        );
      }
      break;
    }
  }

  return root;
}
