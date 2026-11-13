import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { WeaponId } from "./types";
import type { GrenadeKind } from "./grenades";
import { WEAPONS } from "./config";
import { cosmetic, type Cosmetic } from "./cosmetics";

export type HeldAppearanceKey = WeaponId | GrenadeKind | "bomb";

export interface RemoteWeaponRig {
  update: (
    selectedWeapon: WeaponId,
    heldItem: GrenadeKind | "bomb" | undefined,
    weaponSkin: string | undefined,
    isCrouch: boolean,
    pitch: number,
  ) => void;
}

/**
 * Third-person held weapon, knife, utility, and C4 rig attached to a player's right-hand anchor.
 * Builds each item geometry lazily once per remote player and applies their equipped cosmetic finish.
 */
export function createRemoteWeaponRig(
  scene: Scene,
  playerId: string,
  handAnchor: TransformNode,
  material: (color: string, emissive?: boolean, surface?: "metal") => StandardMaterial,
  finishMaterial: (finish: Cosmetic) => StandardMaterial,
): RemoteWeaponRig {
  const roots = new Map<string, TransformNode>();
  const paintedParts = new Map<string, Mesh[]>();
  let activeKey = "";
  let activeSkinKey = "";

  const buildItem = (key: string, finish?: Cosmetic) => {
    const existing = roots.get(key);
    if (existing) return existing;

    const root = new TransformNode(`remote-held-${playerId}-${key}`, scene);
    root.parent = handAnchor;
    const tinted: Mesh[] = [];

    const addBox = (
      name: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
      applySkin = false,
      emissive = false,
    ) => {
      const m = MeshBuilder.CreateBox(
        `remote-${playerId}-${key}-${name}`,
        { width: w, height: h, depth: d },
        scene,
      );
      m.parent = root;
      m.position.set(x, y, z);
      m.material = material(color, emissive, "metal");
      m.metadata = { baseMaterial: m.material };
      m.isPickable = false;
      if (applySkin) tinted.push(m);
      return m;
    };

    const addCyl = (
      name: string,
      x: number,
      y: number,
      z: number,
      diameter: number,
      height: number,
      color: string,
      applySkin = false,
    ) => {
      const m = MeshBuilder.CreateCylinder(
        `remote-${playerId}-${key}-${name}`,
        { diameter, height, tessellation: 10 },
        scene,
      );
      m.parent = root;
      m.position.set(x, y, z);
      m.material = material(color, false, "metal");
      m.metadata = { baseMaterial: m.material };
      m.isPickable = false;
      if (applySkin) tinted.push(m);
      return m;
    };

    if (key === "bomb") {
      addBox("c4-body", 0, 0.02, 0.14, 0.28, 0.14, 0.2, "#596253");
      addBox("c4-lcd", 0.05, 0.095, 0.12, 0.12, 0.02, 0.08, "#73c69b", false, true);
      addBox("c4-keypad", -0.06, 0.095, 0.14, 0.1, 0.02, 0.11, "#232b24");
      const led = MeshBuilder.CreateSphere(
        `remote-${playerId}-bomb-led`,
        { diameter: 0.045, segments: 6 },
        scene,
      );
      led.parent = root;
      led.position.set(0.08, 0.105, 0.18);
      led.material = material("#ff3b3b", true);
      led.isPickable = false;
    } else if (key === "flash" || key === "frag" || key === "smoke") {
      if (key === "frag") {
        const body = MeshBuilder.CreateSphere(
          `remote-${playerId}-frag-body`,
          { diameter: 0.16, segments: 8 },
          scene,
        );
        body.parent = root;
        body.position.set(0, 0.02, 0.1);
        body.scaling.y = 1.2;
        body.material = material("#465d32", false, "metal");
        body.isPickable = false;
        addCyl("rib", 0, 0.02, 0.1, 0.165, 0.02, "#72864b");
      } else {
        const isSmoke = key === "smoke";
        addCyl("can", 0, 0.02, 0.1, isSmoke ? 0.13 : 0.11, isSmoke ? 0.2 : 0.17, isSmoke ? "#455c50" : "#50677b");
        addCyl("band", 0, 0.06, 0.1, isSmoke ? 0.136 : 0.116, 0.02, isSmoke ? "#a7c995" : "#a6d8f2");
      }
      addCyl("cap", 0, 0.12, 0.1, 0.075, 0.03, "#252b2b");
      const lever = addBox("lever", 0.06, 0.06, 0.1, 0.025, 0.12, 0.02, "#949c93");
      lever.rotation.z = 0.22;
    } else if (key.startsWith("knife:")) {
      const style = key.slice("knife:".length) || "default";
      if (style === "karambit") {
        addBox("grip", 0, -0.01, 0.05, 0.045, 0.055, 0.15, "#23313b");
        const ring = MeshBuilder.CreateTorus(
          `remote-${playerId}-${key}-ring`,
          { diameter: 0.08, thickness: 0.015, tessellation: 12 },
          scene,
        );
        ring.parent = root;
        ring.position.set(0, -0.01, -0.04);
        ring.rotation.y = Math.PI / 2;
        ring.material = material("#334155", false, "metal");
        ring.isPickable = false;
        const claw1 = addBox("claw-1", 0, 0.01, 0.16, 0.018, 0.06, 0.13, "#d8e3e9", true);
        claw1.rotation.x = -0.35;
        const claw2 = addBox("claw-2", 0, 0.06, 0.23, 0.014, 0.045, 0.11, "#d8e3e9", true);
        claw2.rotation.x = -0.92;
      } else if (style === "butterfly") {
        addBox("handle-a", -0.018, -0.01, 0.04, 0.022, 0.04, 0.18, "#1f2937");
        addBox("handle-b", 0.018, -0.01, 0.04, 0.022, 0.04, 0.18, "#334155");
        addBox("blade", 0, 0.01, 0.21, 0.016, 0.048, 0.24, "#d8e3e9", true);
      } else if (style === "tanto") {
        addBox("tsuka", 0, 0, 0.04, 0.036, 0.05, 0.18, "#1e293b");
        addBox("tsuba", 0, 0, 0.13, 0.085, 0.06, 0.015, "#d97706");
        addBox("blade", 0, 0.01, 0.26, 0.016, 0.054, 0.25, "#d8e3e9", true);
        const tip = addBox("tip", 0, 0.005, 0.4, 0.012, 0.04, 0.065, "#e2e8f0", true);
        tip.rotation.x = -0.32;
      } else {
        addBox("handle", 0, -0.02, 0.03, 0.055, 0.075, 0.17, "#26313c");
        addBox("guard", 0, 0, 0.12, 0.14, 0.028, 0.032, "#637b8c");
        addBox("blade", 0, 0.01, 0.27, 0.016, 0.058, 0.28, "#d8e3e9", true);
      }
    } else {
      const weaponId = (key in WEAPONS ? key : "rifle") as WeaponId;
      const w = WEAPONS[weaponId];
      const len = Math.max(0.42, w.length * 0.72);
      addBox("receiver", 0, 0, len * 0.12, 0.095, 0.125, len * 0.46, w.color, true);
      addBox("barrel", 0, 0.02, len * 0.54, 0.04, 0.04, len * 0.5, "#26313c", true);
      addBox("grip", 0, -0.1, 0.03, 0.06, 0.15, 0.07, "#273442");
      if (weaponId !== "pistol") {
        addBox("stock", 0, -0.015, -len * 0.18, 0.085, 0.095, Math.max(0.18, len * 0.26), "#334351", true);
      }
      addBox("front-sight", 0, 0.07, len * 0.68, 0.02, 0.06, 0.03, "#121b23");
      if (weaponId === "sniper" || weaponId === "railgun") {
        addBox("scope", 0, 0.12, len * 0.14, 0.068, 0.068, 0.25, "#223845");
        addBox("lens", 0, 0.12, len * 0.14 + 0.13, 0.054, 0.054, 0.01, "#7ac4de");
      }
      if (weaponId === "shotgun") {
        addBox("pump", 0, -0.03, len * 0.36, 0.08, 0.07, 0.18, "#675344", true);
      }
      if (weaponId === "rifle" || weaponId === "smg" || weaponId === "carbine" || weaponId === "lmg") {
        addBox("magazine", 0, -0.12, len * 0.16, weaponId === "lmg" ? 0.14 : 0.058, 0.18, 0.09, "#293844", true);
      }
    }

    if (finish) {
      const mat = finishMaterial(finish);
      for (const m of tinted) m.material = mat;
    }

    roots.set(key, root);
    paintedParts.set(key, tinted);
    return root;
  };

  return {
    update(selectedWeapon, heldItem, weaponSkin, isCrouch, pitch) {
      handAnchor.position.set(0.3, isCrouch ? 0.62 : 0.94, 0.34);
      handAnchor.rotation.x = pitch * 0.72;

      const finish = cosmetic(weaponSkin);
      let key: string;
      if (heldItem === "bomb" || heldItem === "flash" || heldItem === "frag" || heldItem === "smoke") {
        key = heldItem;
      } else if (selectedWeapon === "knife") {
        key = `knife:${finish?.knife || "default"}`;
      } else {
        key = selectedWeapon || "rifle";
      }

      const skinKey = finish ? finish.id : "";
      if (key !== activeKey || skinKey !== activeSkinKey) {
        const targetRoot = buildItem(key, finish);
        for (const [itemKey, node] of roots) {
          node.setEnabled(itemKey === key);
        }
        const parts = paintedParts.get(key);
        if (parts) {
          const mat = finish ? finishMaterial(finish) : undefined;
          for (const mesh of parts) {
            mesh.material = mat ?? mesh.metadata?.baseMaterial;
          }
        }
        targetRoot.setEnabled(true);
        activeKey = key;
        activeSkinKey = skinKey;
      }
    },
  };
}
