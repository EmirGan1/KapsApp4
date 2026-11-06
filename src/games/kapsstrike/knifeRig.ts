import {Scene} from '@babylonjs/core/scene';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData';
import type {Material} from '@babylonjs/core/Materials/material';

export type KnifeRig = {
  karambit: TransformNode;
  blade: TransformNode;
  bite: TransformNode;
  update: (
    style: string,
    deploy: number,
    inspect: number,
    time: number,
    dt: number,
    attack?: number,
    heavy?: boolean,
    combo?: number,
  ) => void;
};

/** Closed, bevelled sections. All parts share real hinge transforms, never per-mesh centre spins. */
function loft(
  scene: Scene,
  name: string,
  sections: { z: number; y: number; x: number; w: number; h: number }[],
  sides = 12,
) {
  const positions: number[] = [],
    indices: number[] = [],
    uvs: number[] = [];
  for (let j = 0; j < sections.length; j++) {
    const s = sections[j];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      positions.push(s.x + Math.cos(a) * s.w, s.y + Math.sin(a) * s.h, s.z);
      uvs.push(i / sides, j / (sections.length - 1));
    }
  }
  for (let j = 0; j < sections.length - 1; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i,
        b = j * sides + ((i + 1) % sides),
        c = a + sides,
        d = b + sides;
      indices.push(a, b, c, b, d, c);
    }
  for (const j of [0, sections.length - 1]) {
    const s = sections[j],
      center = positions.length / 3;
    positions.push(s.x, s.y, s.z);
    uvs.push(0.5, 0.5);
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i,
        b = j * sides + ((i + 1) % sides);
      indices.push(center, ...(j === 0 ? [b, a] : [a, b]));
    }
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  Object.assign(data, { positions, indices, normals, uvs });
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  return mesh;
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
/** Quintic S-curve with sharper mid-swing whip velocity, matching CS finger/hinge momentum. */
const whip = (t: number) => {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

function keysN(t: number, poses: number[][], ease: (x: number) => number = smooth): number[] {
  const clamped = clamp01(t);
  for (let i = 1; i < poses.length; i++) {
    const a = poses[i - 1],
      b = poses[i];
    if (clamped <= b[0]) {
      const span = Math.max(1e-6, b[0] - a[0]);
      const q = ease((clamped - a[0]) / span);
      const out: number[] = [];
      for (let k = 1; k < a.length; k++) {
        out.push(a[k] + (b[k] - a[k]) * q);
      }
      return out;
    }
  }
  return poses.at(-1)!.slice(1);
}

export function createKnifeRig(
  scene: Scene,
  root: TransformNode,
  material: (color: string, metal?: boolean) => Material,
): KnifeRig {
  const attach = (
    m: Mesh,
    parent: TransformNode,
    style: string,
    part: string,
    color: string,
  ) => {
    m.parent = parent;
    m.metadata = { knifeStyle: style, knifePart: part };
    m.material = material(color, part !== 'handle');
    m.renderingGroupId = 2;
    m.isPickable = false;
    return m;
  };

  // ============================================================================
  // 1. KARAMBIT RIG (Seamless Unbroken Silhouette: Ring -> Sculpted Grip ->
  //    Upward-Curving Hawkbill Claw Blade Along One Continuous Axis)
  // ============================================================================
  const karambit = new TransformNode('karambit-ring-pivot', scene);
  karambit.parent = root;
  karambit.position.set(0, 0.005, -0.23);

  const body = new TransformNode('karambit-body', scene);
  body.parent = karambit;
  body.position.set(0, -0.005, 0.23);

  // Seamless sculpted grip aligned directly between ring (z = -0.23) and blade (z = 0)
  const grip = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    const arc = Math.sin(t * Math.PI);
    return {
      z: -0.18 + t * 0.215,
      x: 0,
      y: -0.008 - arc * 0.012,
      w: 0.018 + arc * 0.009,
      h: 0.023 + arc * 0.013 - Math.pow(Math.sin(t * 3 * Math.PI), 2) * 0.003,
    };
  });
  attach(
    loft(scene, 'karambit-sculpted-grip', grip, 12),
    body,
    'karambit',
    'handle',
    '#23313b',
  );

  // Seamless Hawkbill Tiger-Claw blade curving smoothly upward (+Y) from the grip
  const profile = [
    [-0.005, -0.014, 0.008, 0.031],
    [0.025, -0.022, 0.009, 0.038],
    [0.06, -0.027, 0.009, 0.044],
    [0.10, -0.026, 0.008, 0.047],
    [0.14, -0.011, 0.007, 0.048],
    [0.175, 0.014, 0.006, 0.042],
    [0.20, 0.047, 0.005, 0.033],
    [0.218, 0.082, 0.003, 0.019],
    [0.225, 0.112, 0.0003, 0.0005],
  ];
  attach(
    loft(
      scene,
      'karambit-hawkbill',
      profile.map(([z, y, w, h]) => ({ z, y, x: 0, w, h })),
      4,
    ),
    body,
    'karambit',
    'blade',
    '#d8e3e9',
  );

  // Integrated index-finger safety ring (pinned at karambit-ring-pivot origin)
  const ring = attach(
    MeshBuilder.CreateTorus(
      'karambit-integrated-ring',
      { diameter: 0.108, thickness: 0.017, tessellation: 40 },
      scene,
    ),
    body,
    'karambit',
    'ring',
    '#9baeba',
  );
  ring.position.set(0, 0.005, -0.23);
  ring.rotation.z = Math.PI / 2;

  for (const z of [-0.15, -0.05]) {
    const pin = attach(
      MeshBuilder.CreateCylinder(
        'karambit-flush-pin',
        { diameter: 0.014, height: 0.056, tessellation: 12 },
        scene,
      ),
      body,
      'karambit',
      'ring',
      '#81939e',
    );
    pin.position.set(0, -0.018, z);
    pin.rotation.z = Math.PI / 2;
  }

  // ============================================================================
  // 2. BUTTERFLY / KELEBEK RIG (CS:GO / CS2 1-to-1 Balisong Dual-Hinge & Latch)
  // ============================================================================
  const butterflyWrist = new TransformNode('butterfly-wrist-pivot', scene);
  butterflyWrist.parent = root;
  butterflyWrist.position.set(0, -0.028, 0.018);

  const fixed = new TransformNode('butterfly-safe-hinge', scene);
  fixed.parent = butterflyWrist;
  fixed.position.set(0, 0, 0);

  const blade = new TransformNode('butterfly-blade-hinge', scene);
  blade.parent = butterflyWrist;
  blade.position.set(0, 0, 0);

  const bite = new TransformNode('butterfly-bite-hinge', scene);
  bite.parent = blade;
  bite.position.set(0, 0.036, 0);

  function handle(parent: TransformNode, name: string) {
    for (const x of [-0.0115, 0.0115]) {
      const rail = Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        const swell = Math.sin(t * Math.PI);
        return {
          x,
          y: 0,
          z: -t * 0.285,
          w: 0.0058 * (0.75 + swell * 0.28),
          h: 0.0155 * (0.82 + swell * 0.24),
        };
      });
      attach(loft(scene, name + '-rail', rail, 8), parent, 'butterfly', 'handle', '#1e2d38');
    }
    const bolster = attach(
      MeshBuilder.CreateBox(
        name + '-bolster',
        { width: 0.031, height: 0.028, depth: 0.048 },
        scene,
      ),
      parent,
      'butterfly',
      'ring',
      '#8fa3b0',
    );
    bolster.position.set(0, 0, -0.026);

    for (const z of [-0.085, -0.145, -0.205]) {
      const inlay = attach(
        MeshBuilder.CreateBox(
          name + '-inlay',
          { width: 0.027, height: 0.018, depth: 0.038 },
          scene,
        ),
        parent,
        'butterfly',
        'blade',
        '#334155',
      );
      inlay.position.set(0, 0, z);
    }

    for (const z of [-0.02, -0.115, -0.195, -0.275]) {
      const pin = attach(
        MeshBuilder.CreateCylinder(
          name + '-spacer',
          { diameter: 0.022, height: 0.034, tessellation: 12 },
          scene,
        ),
        parent,
        'butterfly',
        'ring',
        '#748997',
      );
      pin.rotation.z = Math.PI / 2;
      pin.position.z = z;
    }
    const cap = attach(
      MeshBuilder.CreateSphere(name + '-rounded-butt', { diameter: 0.032, segments: 12 }, scene),
      parent,
      'butterfly',
      'handle',
      '#1e2d38',
    );
    cap.position.z = -0.285;
    cap.scaling.y = 1.15;
  }

  handle(fixed, 'butterfly-safe');
  handle(bite, 'butterfly-bite');

  const balisongBlade = attach(
    loft(
      scene,
      'butterfly-ground-blade',
      [
        { z: -0.01, y: 0, x: 0, w: 0.0065, h: 0.024 },
        { z: 0.035, y: 0, x: 0, w: 0.007, h: 0.028 },
        { z: 0.11, y: -0.002, x: 0, w: 0.0065, h: 0.025 },
        { z: 0.20, y: 0.003, x: 0, w: 0.0055, h: 0.027 },
        { z: 0.275, y: 0.009, x: 0, w: 0.0035, h: 0.016 },
        { z: 0.325, y: 0.015, x: 0, w: 0.0003, h: 0.0004 },
      ],
      4,
    ),
    blade,
    'butterfly',
    'blade',
    '#d8e3e9',
  );
  balisongBlade.position.y = 0.018;

  const tangBlock = attach(
    MeshBuilder.CreateBox(
      'butterfly-tang-horns',
      { width: 0.014, height: 0.052, depth: 0.036 },
      scene,
    ),
    blade,
    'butterfly',
    'ring',
    '#9babb6',
  );
  tangBlock.position.set(0, 0.018, 0.006);

  for (const [i, hinge] of [fixed, bite].entries()) {
    const pin = attach(
      MeshBuilder.CreateCylinder(
        'butterfly-hinge-pin-' + i,
        { diameter: 0.022, height: 0.042, tessellation: 16 },
        scene,
      ),
      hinge,
      'butterfly',
      'ring',
      '#cbd5e1',
    );
    pin.rotation.z = Math.PI / 2;
  }

  const latch = attach(
    MeshBuilder.CreateCapsule(
      'butterfly-latch',
      { height: 0.048, radius: 0.0065, tessellation: 10 },
      scene,
    ),
    bite,
    'butterfly',
    'ring',
    '#cbd5e1',
  );
  latch.position.set(0, 0, -0.30);
  latch.rotation.x = Math.PI / 2;

  // ============================================================================
  // 3. ARTICULATED FIRST-PERSON GLOVED HANDS & FINGERS
  // ============================================================================
  const handNodes: Record<
    string,
    {
      palm: TransformNode;
      fingers: TransformNode;
      thumb: TransformNode;
    }
  > = {};

  for (const style of ['karambit', 'butterfly']) {
    const palmNode = new TransformNode(style + '-hand-palm-node', scene);
    palmNode.parent = root;
    palmNode.position.set(0, -0.058, -0.125);

    const palm = attach(
      MeshBuilder.CreateSphere(style + '-glove-palm', { diameter: 0.112, segments: 12 }, scene),
      palmNode,
      style,
      'handle',
      '#182630',
    );
    palm.scaling.set(0.65, 0.62, 1.22);

    const wrist = attach(
      MeshBuilder.CreateCapsule(
        style + '-glove-wrist',
        { height: 0.17, radius: 0.035, tessellation: 10 },
        scene,
      ),
      palmNode,
      style,
      'handle',
      '#142029',
    );
    wrist.rotation.x = Math.PI / 2;
    wrist.position.set(0, -0.018, -0.12);

    const fingersNode = new TransformNode(style + '-hand-fingers-pivot', scene);
    fingersNode.parent = palmNode;
    fingersNode.position.set(-0.022, 0.026, 0.015);

    for (const [idx, z] of [0.04, 0.0, -0.04].entries()) {
      const finger = attach(
        MeshBuilder.CreateCapsule(
          style + '-glove-finger-' + idx,
          { height: 0.078, radius: 0.0125, tessellation: 10 },
          scene,
        ),
        fingersNode,
        style,
        'handle',
        '#283b45',
      );
      finger.rotation.z = Math.PI / 2;
      finger.position.set(0.022, 0.004, z);
    }

    const thumbNode = new TransformNode(style + '-hand-thumb-pivot', scene);
    thumbNode.parent = palmNode;
    thumbNode.position.set(0.032, 0.028, 0.025);
    const thumb = attach(
      MeshBuilder.CreateCapsule(
        style + '-glove-thumb',
        { height: 0.068, radius: 0.013, tessellation: 10 },
        scene,
      ),
      thumbNode,
      style,
      'handle',
      '#283b45',
    );
    thumb.rotation.set(0.35, 0.25, 0.55);

    if (style === 'karambit') {
      const ringFinger = attach(
        MeshBuilder.CreateCapsule(
          'karambit-ring-finger',
          { height: 0.082, radius: 0.0135, tessellation: 10 },
          scene,
        ),
        root,
        style,
        'handle',
        '#283b45',
      );
      ringFinger.rotation.z = Math.PI / 2;
      ringFinger.position.set(0, 0.005, -0.23);
    }

    handNodes[style] = { palm: palmNode, fingers: fingersNode, thumb: thumbNode };
  }

  const settleAngle = (current: number, dt: number) => {
    const a = Math.atan2(Math.sin(current), Math.cos(current));
    return a * Math.exp(-dt * 24);
  };

  const T = Math.PI * 2;

  return {
    karambit,
    blade,
    bite,
    update(style, deploy, inspect, time, dt, attack = -1, heavy = false, combo = 0) {
      const busy = deploy >= 0 || inspect >= 0 || attack >= 0;

      // ======================================================================
      // KARAMBIT CS:GO / CS2 1-TO-1 ANIMATION SOLVER (ug6MTTzN6l4)
      // ======================================================================
      let kx = 0,
        ky = 0,
        kz = 0,
        kFingerOpen = 0;

      if (style === 'karambit') {
        if (deploy >= 0) {
          const [spin, cantY, cantZ, open] = keysN(
            deploy,
            [
              [0.0, T * 1.05, -0.28, 0.24, 0.85],
              [0.16, T * 0.88, -0.22, 0.18, 1.0],
              [0.48, T * 0.32, 0.16, -0.14, 0.95],
              [0.76, -0.16, 0.05, -0.06, 0.22],
              [0.89, 0.04, -0.02, 0.02, 0.0],
              [1.0, 0.0, 0.0, 0.0, 0.0],
            ],
            whip,
          );
          kx = spin;
          ky = cantY;
          kz = cantZ;
          kFingerOpen = open;
        } else if (inspect >= 0) {
          if (inspect < 0.86) {
            const p = inspect / 0.86;
            const continuousPhase = 0.22 * p + 0.78 * smooth(p);
            const totalAngle = continuousPhase * 3 * T;
            const whipMod = Math.sin(totalAngle) * 0.18 * Math.sin(p * Math.PI);
            kx = totalAngle + whipMod;
            const env = Math.sin(p * Math.PI);
            ky = 0.20 * env + Math.sin(totalAngle) * 0.16 * env;
            kz = -0.14 * env + Math.cos(totalAngle) * 0.14 * env;
            kFingerOpen = clamp01(Math.sin(p * Math.PI) * 1.35);
          } else {
            const catchPhase = (inspect - 0.86) / 0.14;
            const slap = Math.sin(catchPhase * Math.PI * 2) * Math.exp(-catchPhase * 4.5) * 0.18;
            kx = 3 * T - slap;
            ky = 0;
            kz = 0;
            kFingerOpen = Math.max(0, 1 - catchPhase * 3);
          }
        } else if (attack >= 0) {
          const s = Math.sin(attack * Math.PI);
          if (heavy) {
            kx = -s * 0.46;
            ky = s * 0.22;
            kz = -s * 0.24;
          } else {
            const dir = combo === 0 ? 1 : -1;
            kx = -s * 0.34;
            ky = dir * s * 0.28;
            kz = dir * s * 0.22;
          }
          kFingerOpen = 0;
        } else {
          kx = Math.sin(time * 1.9) * 0.028;
          ky = Math.cos(time * 1.4) * 0.014;
          kz = Math.sin(time * 1.1) * 0.011;
          kFingerOpen = 0;
        }
      }

      if (style === 'karambit' && busy) {
        karambit.rotation.set(kx, ky, kz);
      } else if (style === 'karambit') {
        karambit.rotation.set(
          kx,
          settleAngle(karambit.rotation.y, dt) + ky,
          settleAngle(karambit.rotation.z, dt) + kz,
        );
      } else {
        karambit.rotation.set(
          settleAngle(karambit.rotation.x, dt),
          settleAngle(karambit.rotation.y, dt),
          settleAngle(karambit.rotation.z, dt),
        );
      }

      const kHand = handNodes.karambit;
      if (kHand) {
        kHand.fingers.rotation.set(
          kFingerOpen * 0.48,
          -kFingerOpen * 0.32,
          -kFingerOpen * 0.92,
        );
        kHand.thumb.rotation.set(
          -kFingerOpen * 0.42,
          kFingerOpen * 0.48,
          kFingerOpen * 0.62,
        );
      }

      // ======================================================================
      // BUTTERFLY / KELEBEK CS:GO / CS2 1-TO-1 ANIMATION SOLVER (eAgyDNX2GhI)
      // ======================================================================
      let b = 0,
        h = 0,
        wx = 0,
        wy = 0,
        wz = 0,
        safeX = 0,
        latchSwing = 0,
        bFingerOpen = 0;

      if (style === 'butterfly') {
        if (deploy >= 0) {
          const [bladeX, biteX, wristX, wristY, wristZ, safePitch, lSwing, fOpen] = keysN(
            deploy,
            [
              [0.0, Math.PI, Math.PI, 0.35, -0.22, 0.0, 0.0, 0.6, 0.5],
              [0.18, 2.55, 0.45, -0.28, -0.12, Math.PI * 0.45, -0.18, 1.1, 0.85],
              [0.36, 1.65, -1.25, -0.42, 0.18, Math.PI * 1.05, -0.32, 1.35, 0.95],
              [0.62, -0.28, 4.85, 0.24, 0.14, Math.PI * 1.72, 0.14, 0.95, 0.75],
              [0.84, 0.11, 6.46, -0.09, -0.04, T + 0.12, -0.06, 0.25, 0.15],
              [0.93, -0.025, T - 0.04, 0.03, 0.01, T - 0.03, 0.01, -0.05, 0.0],
              [1.0, 0.0, T, 0.0, 0.0, T, 0.0, 0.0, 0.0],
            ],
            whip,
          );
          b = bladeX;
          h = biteX;
          wx = wristX;
          wy = wristY;
          wz = wristZ;
          safeX = safePitch;
          latchSwing = lSwing;
          bFingerOpen = fOpen;
        } else if (inspect >= 0) {
          if (inspect < 0.88) {
            const p = inspect / 0.88;
            const carrier = 0.38 * p + 0.62 * smooth(p);
            const env = Math.sin(p * Math.PI);
            const spinTurns = 4;
            const baseTheta = carrier * spinTurns * T;

            b = baseTheta + Math.sin(p * Math.PI * 6) * 0.68 * env;
            h =
              baseTheta +
              Math.sin(p * Math.PI * 8 - 0.45) * 1.35 * env +
              Math.sin(p * Math.PI) * 0.55;

            wz = carrier * 3 * T + Math.sin(p * Math.PI * 4) * 0.35 * env;
            wx = Math.sin(p * Math.PI * 6) * 0.34 * env;
            wy = Math.cos(p * Math.PI * 6) * 0.26 * env;
            safeX = Math.sin(p * Math.PI * 8) * 0.28 * env;
            latchSwing = (1.15 + Math.sin(p * Math.PI * 10) * 0.35) * env;
            bFingerOpen = clamp01(env * 1.4);
          } else {
            const tail = (inspect - 0.88) / 0.12;
            const clack = Math.sin(tail * Math.PI * 2) * Math.exp(-tail * 5.0);
            b = 4 * T - clack * 0.12;
            h = 4 * T + clack * 0.24;
            wz = 3 * T + clack * 0.10;
            wx = clack * 0.08;
            wy = -clack * 0.05;
            safeX = clack * 0.06;
            latchSwing = Math.max(0, (1 - tail * 2.5) * 0.35);
            bFingerOpen = Math.max(0, 1 - tail * 3.0);
          }
        } else if (attack >= 0) {
          const s = Math.sin(attack * Math.PI);
          const tail = Math.sin(clamp01((attack - 0.45) / 0.55) * Math.PI);
          if (heavy) {
            wx = s * 0.32;
            wz = tail * 0.45;
            b = tail * 0.22;
            h = tail * 0.38;
          } else {
            const dir = combo === 0 ? 1 : -1;
            wy = dir * s * 0.25;
            wz = dir * s * 0.42;
            b = tail * 0.18;
            h = tail * 0.32;
          }
        }
      }

      if (style === 'butterfly' && busy) {
        blade.rotation.x = b;
        bite.rotation.x = h;
        butterflyWrist.rotation.set(wx, wy, wz);
        fixed.rotation.x = safeX;
        latch.rotation.x = Math.PI / 2 + latchSwing;
      } else {
        blade.rotation.x = settleAngle(blade.rotation.x, dt);
        bite.rotation.x = settleAngle(bite.rotation.x, dt);
        butterflyWrist.rotation.set(
          settleAngle(butterflyWrist.rotation.x, dt),
          settleAngle(butterflyWrist.rotation.y, dt),
          settleAngle(butterflyWrist.rotation.z, dt),
        );
        fixed.rotation.x = settleAngle(fixed.rotation.x, dt);
        latch.rotation.x = Math.PI / 2 + settleAngle(latch.rotation.x - Math.PI / 2, dt);
      }

      const bHand = handNodes.butterfly;
      if (bHand) {
        bHand.fingers.rotation.set(
          bFingerOpen * 0.42,
          -bFingerOpen * 0.25,
          -bFingerOpen * 0.78,
        );
        bHand.thumb.rotation.set(
          -bFingerOpen * 0.38,
          bFingerOpen * 0.45,
          bFingerOpen * 0.52,
        );
      }

      butterflyWrist.computeWorldMatrix(true);
      fixed.computeWorldMatrix(true);
      blade.computeWorldMatrix(true);
      bite.computeWorldMatrix(true);
      karambit.computeWorldMatrix(true);
    },
  };
}
