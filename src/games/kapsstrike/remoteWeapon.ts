import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { WeaponId } from "./types";
import type { GrenadeKind } from "./grenades";
import { WEAPONS } from "./config";
import { cosmetic, type Cosmetic } from "./cosmetics";
import { buildWeaponModel } from "./weaponModels";
import { applyWeaponCosmetic, type WeaponQualityTier } from "./weaponMaterials";
import { WEAPON_PRESENTATION } from "./weaponAssets";

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
 * Uses the unified sculpted 3D weapon model system ('world' LOD) and shared cosmetic material
 * resolver so first-person, third-person, dropped weapons, and inventory previews match 1:1.
 */
export function createRemoteWeaponRig(
  scene: Scene,
  playerId: string,
  handAnchor: TransformNode,
  material: (color: string, emissive?: boolean, surface?: "metal") => StandardMaterial,
  _finishMaterial?: (finish: Cosmetic) => StandardMaterial,
  quality: WeaponQualityTier = "high",
): RemoteWeaponRig {
  const roots = new Map<string, TransformNode>();
  let activeKey = "";
  let activeSkinKey = "";

  const buildUtilityOrBomb = (key: "bomb" | GrenadeKind) => {
    const root = new TransformNode(`remote-held-${playerId}-${key}`, scene);
    root.parent = handAnchor;
    const addBox = (
      name: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
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
      m.isPickable = false;
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
    ) => {
      const m = MeshBuilder.CreateCylinder(
        `remote-${playerId}-${key}-${name}`,
        { diameter, height, tessellation: 10 },
        scene,
      );
      m.parent = root;
      m.position.set(x, y, z);
      m.material = material(color, false, "metal");
      m.isPickable = false;
      return m;
    };

    if (key === "bomb") {
      addBox("c4-body", 0, 0.02, 0.14, 0.28, 0.14, 0.2, "#596253");
      addBox("c4-lcd", 0.05, 0.095, 0.12, 0.12, 0.02, 0.08, "#73c69b", true);
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
    } else {
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
        addCyl(
          "can",
          0,
          0.02,
          0.1,
          isSmoke ? 0.13 : 0.11,
          isSmoke ? 0.2 : 0.17,
          isSmoke ? "#455c50" : "#50677b",
        );
        addCyl(
          "band",
          0,
          0.06,
          0.1,
          isSmoke ? 0.136 : 0.116,
          0.02,
          isSmoke ? "#a7c995" : "#a6d8f2",
        );
      }
      addCyl("cap", 0, 0.12, 0.1, 0.075, 0.03, "#252b2b");
      const lever = addBox("lever", 0.06, 0.06, 0.1, 0.025, 0.12, 0.02, "#949c93");
      lever.rotation.z = 0.22;
    }
    return root;
  };

  const buildItem = (key: string) => {
    const existing = roots.get(key);
    if (existing) return existing;

    let root: TransformNode;
    if (key === "bomb" || key === "flash" || key === "frag" || key === "smoke") {
      root = buildUtilityOrBomb(key);
    } else if (key.startsWith("knife:")) {
      const style = (key.slice("knife:".length) || "default") as
        | "default"
        | "tanto"
        | "karambit"
        | "butterfly";
      root = buildWeaponModel(scene, "knife", {
        detail: "world",
        quality,
        prefix: `remote-${playerId}-${key}-`,
        knifeStyle: style,
      });
      root.parent = handAnchor;
      root.position.set(0, 0.02, 0.16);
      root.scaling.setAll(WEAPON_PRESENTATION.knife.tpScale);
    } else {
      const weaponId = (key in WEAPONS ? key : "rifle") as WeaponId;
      root = buildWeaponModel(scene, weaponId, {
        detail: "world",
        quality,
        prefix: `remote-${playerId}-${key}-`,
      });
      root.parent = handAnchor;
      const spec = WEAPON_PRESENTATION[weaponId];
      root.position.set(0, 0.04, weaponId === "pistol" ? 0.14 : 0.18);
      root.scaling.setAll(spec.tpScale);
    }

    roots.set(key, root);
    return root;
  };

  return {
    update(selectedWeapon, heldItem, weaponSkin, isCrouch, pitch) {
      handAnchor.position.set(0.3, isCrouch ? 0.62 : 0.94, 0.34);
      handAnchor.rotation.x = pitch * 0.72;

      const finish = cosmetic(weaponSkin);
      let key: string;
      let weaponId: WeaponId | undefined;
      if (heldItem === "bomb" || heldItem === "flash" || heldItem === "frag" || heldItem === "smoke") {
        key = heldItem;
      } else if (selectedWeapon === "knife") {
        key = `knife:${finish?.knife || "default"}`;
        weaponId = "knife";
      } else {
        weaponId = selectedWeapon || "rifle";
        key = weaponId;
      }

      const skinKey = finish ? finish.id : "";
      if (key !== activeKey || skinKey !== activeSkinKey) {
        const targetRoot = buildItem(key);
        for (const [itemKey, node] of roots) {
          node.setEnabled(itemKey === key);
        }
        if (weaponId) {
          applyWeaponCosmetic(targetRoot, weaponId, finish, scene, quality);
        }
        targetRoot.setEnabled(true);
        activeKey = key;
        activeSkinKey = skinKey;
      }
    },
  };
}
