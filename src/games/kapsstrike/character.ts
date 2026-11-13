import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { cleanSkin, SKINS } from "./skins";
import { TARGET_HITBOXES as H } from "./config";

/** Cosmetics never become collision/hit geometry. All variants retain identical server hitboxes. */
export function createCharacter(
  scene: Scene,
  id: string,
  skinValue: unknown,
  team = "none",
  outline = false,
  outlineColor = "#ff315d",
) {
  const skinId = cleanSkin(skinValue);
  const skin = SKINS[skinId];
  const root = new TransformNode(`character-${id}`, scene);
  const materials: StandardMaterial[] = [];
  const cache = new Map<string, StandardMaterial>();

  const material = (color: string, mode: "cloth" | "armor" | "metal" | "glow" | "skin" = "cloth") => {
    const key = color + ":" + mode;
    let m = cache.get(key);
    if (m) return m;
    m = new StandardMaterial(`${id}-${key}`, scene);
    m.diffuseColor = Color3.FromHexString(color);
    if (mode === "glow") {
      m.specularColor = new Color3(0.25, 0.25, 0.25);
      m.emissiveColor = m.diffuseColor.scale(0.45);
    } else if (mode === "metal") {
      m.specularColor = new Color3(0.42, 0.46, 0.52);
      m.specularPower = 64;
      m.emissiveColor = m.diffuseColor.scale(0.05);
    } else if (mode === "armor") {
      m.specularColor = new Color3(0.16, 0.17, 0.19);
      m.specularPower = 32;
      m.emissiveColor = m.diffuseColor.scale(0.05);
    } else if (mode === "skin") {
      m.specularColor = new Color3(0.05, 0.04, 0.04);
      m.emissiveColor = m.diffuseColor.scale(0.06);
    } else {
      m.specularColor = new Color3(0.04, 0.04, 0.05);
      m.emissiveColor = m.diffuseColor.scale(0.06);
    }
    m.freeze();
    cache.set(key, m);
    materials.push(m);
    return m;
  };

  const part = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    mode: "cloth" | "armor" | "metal" | "glow" | "skin" = "cloth",
  ) => {
    const m = MeshBuilder.CreateBox(`${id}-${name}`, { width: w, height: h, depth: d }, scene);
    m.parent = root;
    m.position.set(x, y, z);
    m.material = material(color, mode);
    m.isPickable = false;
    return m;
  };

  // Hitbox reference meshes (MUST retain exact TARGET_HITBOXES bounds)
  const body = part(
    "body",
    0,
    (H.body.min + H.body.max) / 2,
    0,
    H.body.radius * 2,
    H.body.max - H.body.min,
    H.body.radius * 2,
    skin.body,
    "cloth",
  );
  const neck = part(
    "neck",
    0,
    (H.body.max + H.head.min) / 2,
    0,
    0.2,
    H.head.min - H.body.max,
    0.2,
    "#cfa98e",
    "skin",
  );
  const head = part(
    "head",
    0,
    (H.head.min + H.head.max) / 2,
    0,
    H.head.radius * 2,
    H.head.radius * 2,
    H.head.radius * 2,
    "#d4ae92",
    "skin",
  );

  const gearRoot = new TransformNode(`${id}-gear`, scene);
  gearRoot.parent = root;

  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    mode: "cloth" | "armor" | "metal" | "glow" | "skin" = "armor",
    parent: TransformNode = gearRoot,
  ) => {
    const m = part(name, x, y, z, w, h, d, color, mode);
    m.parent = parent;
    return m;
  };

  const cyl = (
    name: string,
    x: number,
    y: number,
    z: number,
    diameter: number,
    height: number,
    color: string,
    mode: "cloth" | "armor" | "metal" | "glow" | "skin" = "armor",
    tessellation = 10,
    parent: TransformNode = gearRoot,
  ) => {
    const m = MeshBuilder.CreateCylinder(`${id}-${name}`, { diameter, height, tessellation }, scene);
    m.parent = parent;
    m.position.set(x, y, z);
    m.material = material(color, mode);
    m.isPickable = false;
    return m;
  };

  const sphere = (
    name: string,
    x: number,
    y: number,
    z: number,
    diameter: number,
    color: string,
    mode: "cloth" | "armor" | "metal" | "glow" | "skin" = "armor",
    segments = 8,
    parent: TransformNode = gearRoot,
  ) => {
    const m = MeshBuilder.CreateSphere(`${id}-${name}`, { diameter, segments }, scene);
    m.parent = parent;
    m.position.set(x, y, z);
    m.material = material(color, mode);
    m.isPickable = false;
    return m;
  };

  const teamColor = team === "red" ? "#ed6a66" : team === "blue" ? "#68adf0" : "#f39265";
  const armorBase = skin.trim;
  const darkKit = "#1d2229";
  const leather = "#2b2520";
  const gloveColor = "#1a1f24";

  // =========================================================================
  // 1. REALISTIC TACTICAL PLATE CARRIER, POUCHES & CHEST RIG
  // =========================================================================
  box("chest-plate-front", 0, 1.04, 0.355, 0.56, 0.44, 0.06, armorBase, "armor");
  box("chest-plate-back", 0, 1.04, -0.355, 0.54, 0.44, 0.06, armorBase, "armor");
  box("shoulder-strap-l", -0.22, 1.29, 0, 0.14, 0.06, 0.64, armorBase, "armor");
  box("shoulder-strap-r", 0.22, 1.29, 0, 0.14, 0.06, 0.64, armorBase, "armor");
  box("team-band", 0, 1.18, 0.39, 0.26, 0.075, 0.025, teamColor, "glow");
  // Chest rifle mag pouches + admin pouch
  for (let i = -1; i <= 1; i++) {
    box(`mag-pouch-${i + 1}`, i * 0.135, 0.87, 0.395, 0.105, 0.16, 0.055, skin.accent, "cloth");
  }
  box("radio-box", -0.27, 1.13, 0.36, 0.085, 0.14, 0.055, darkKit, "metal");
  cyl("radio-whip", -0.29, 1.29, 0.36, 0.016, 0.22, darkKit, "metal", 6);

  // =========================================================================
  // 2. TACTICAL BELT, HOLSTER & ARTICULATED ARMS / LEGS / COMBAT BOOTS
  // =========================================================================
  box("belt", 0, 0.56, 0, 0.72, 0.085, 0.72, darkKit, "armor");
  box("belt-buckle", 0, 0.56, 0.37, 0.1, 0.07, 0.03, "#9aa5b1", "metal");
  box("dump-pouch", -0.37, 0.52, -0.1, 0.07, 0.16, 0.18, armorBase, "cloth");
  box("drop-holster", 0.37, 0.42, 0.04, 0.08, 0.22, 0.15, leather, "armor");

  // Legs (thighs, kneepads, shins, combat boots)
  for (const [side, sx] of [["l", -0.17], ["r", 0.17]] as const) {
    cyl(`thigh-${side}`, sx, 0.35, 0, 0.25, 0.34, skin.body, "cloth", 10);
    box(`kneepad-${side}`, sx, 0.25, 0.13, 0.17, 0.12, 0.06, darkKit, "armor");
    cyl(`shin-${side}`, sx, 0.14, 0, 0.21, 0.22, skin.body, "cloth", 10);
    box(`boot-${side}`, sx, 0.055, 0.04, 0.2, 0.11, 0.32, leather, "armor");
  }

  // Arms (shoulder pads, upper sleeve, forearm + wrist, tactical gloves)
  box("arm-l-upper", -0.43, 1.15, 0.02, 0.18, 0.29, 0.21, skin.body, "cloth");
  sphere("shoulder-pad-l", -0.42, 1.27, 0, 0.22, armorBase, "armor", 8);
  const foreL = box("arm-l-fore", -0.41, 0.91, 0.16, 0.15, 0.26, 0.17, skin.body, "cloth");
  foreL.rotation.x = -0.68;
  sphere("glove-l", -0.38, 0.82, 0.3, 0.14, gloveColor, "armor", 8);

  box("arm-r-upper", 0.43, 1.15, 0.02, 0.18, 0.29, 0.21, skin.body, "cloth");
  sphere("shoulder-pad-r", 0.42, 1.27, 0, 0.22, armorBase, "armor", 8);
  const foreR = box("arm-r-fore", 0.38, 0.95, 0.2, 0.15, 0.26, 0.17, skin.body, "cloth");
  foreR.rotation.x = -1.05;
  sphere("glove-r", 0.34, 0.9, 0.36, 0.14, gloveColor, "armor", 8);

  // =========================================================================
  // 3. ANATOMICAL HEAD / BALACLAVA / FACE DETAILS
  // =========================================================================
  box("balaclava-lower", 0, 1.54, 0.015, 0.455, 0.21, 0.455, darkKit, "cloth");
  box("nose-bridge", 0, 1.66, 0.225, 0.06, 0.09, 0.045, "#c99f83", "skin");
  box("eye-l", -0.1, 1.7, 0.222, 0.065, 0.032, 0.02, "#1c242e", "metal");
  box("eye-r", 0.1, 1.7, 0.222, 0.065, 0.032, 0.02, "#1c242e", "metal");

  // =========================================================================
  // 4. SKIN-SPECIFIC HEADGEAR & SIGNATURE TACTICAL KIT (Unique mesh names!)
  // =========================================================================
  if (skin.gear === "helmet") {
    const dome = sphere("helmet-dome", 0, 1.81, -0.01, 0.5, skin.trim, "armor", 10);
    dome.scaling.set(1.02, 0.68, 1.06);
    box("helmet-rim", 0, 1.79, 0, 0.5, 0.08, 0.51, skin.accent, "armor");
    box("pack", 0, 1.0, -0.45, 0.42, 0.5, 0.16, skin.trim, "cloth");
  }
  if (skin.gear === "hood") {
    box("hood", 0, 1.81, -0.05, 0.51, 0.26, 0.46, skin.body, "cloth");
    box("scarf", 0, 1.43, 0.06, 0.5, 0.14, 0.45, skin.trim, "cloth");
    box("goggles-urban", 0, 1.7, 0.235, 0.36, 0.085, 0.04, skin.trim, "metal");
  }
  if (skin.gear === "antenna") {
    cyl("antenna", 0.25, 2.0, -0.04, 0.03, 0.4, skin.trim, "glow", 6);
    box("powerpack", 0, 1.04, -0.44, 0.34, 0.48, 0.16, skin.accent, "metal");
    box("neon-visor", 0, 1.7, 0.235, 0.38, 0.09, 0.04, skin.trim, "glow");
  }
  if (skin.gear === "visor") {
    box("visor", 0, 1.7, 0.238, 0.44, 0.11, 0.045, skin.trim, "glow");
    box("shadow-hood", 0, 1.81, -0.04, 0.49, 0.24, 0.47, skin.accent, "cloth");
    box("shoulder", -0.44, 1.29, 0, 0.24, 0.18, 0.3, skin.trim, "armor");
  }
  if (skin.gear === "hat") {
    cyl("brim", 0, 1.84, 0, 0.72, 0.035, skin.trim, "cloth", 14);
    cyl("hat-top", 0, 1.91, 0, 0.44, 0.14, skin.body, "cloth", 12);
    box("scarf-desert", 0, 1.43, 0.05, 0.5, 0.15, 0.46, skin.trim, "cloth");
  }
  if (skin.gear === "parka") {
    box("collar", 0, 1.42, 0, 0.64, 0.18, 0.52, skin.trim, "cloth");
    box("parka-hood", 0, 1.81, -0.06, 0.54, 0.26, 0.45, skin.body, "cloth");
    box("coat-tail", 0, 0.46, -0.22, 0.64, 0.28, 0.18, skin.body, "cloth");
  }
  if (skin.gear === "fins") {
    box("fin-l", -0.27, 1.85, -0.02, 0.08, 0.38, 0.24, skin.trim, "glow");
    box("fin-r", 0.27, 1.85, -0.02, 0.08, 0.38, 0.24, skin.trim, "glow");
    box("cyber-visor", 0, 1.7, 0.235, 0.42, 0.1, 0.045, skin.trim, "glow");
  }
  if (skin.gear === "cap") {
    box("cap", 0, 1.84, -0.01, 0.48, 0.13, 0.47, skin.trim, "cloth");
    box("cap-brim", 0, 1.81, 0.29, 0.48, 0.035, 0.24, skin.trim, "cloth");
    box("pad-r", 0.43, 1.3, 0, 0.25, 0.19, 0.35, skin.trim, "armor");
  }
  if (skin.gear === "nvg") {
    const mich = sphere("nvg-helmet", 0, 1.82, -0.01, 0.5, skin.trim, "armor", 10);
    mich.scaling.set(1.02, 0.66, 1.06);
    box("nvg-mount", 0, 1.81, 0.25, 0.12, 0.09, 0.08, darkKit, "metal");
    box("nvg-bridge", 0, 1.74, 0.29, 0.3, 0.04, 0.05, darkKit, "metal");
    for (const [idx, ox] of [-0.12, -0.045, 0.045, 0.12].entries()) {
      const tube = cyl(`nvg-tube-${idx}`, ox, 1.74, 0.33, 0.058, 0.12, darkKit, "metal", 8);
      tube.rotation.x = Math.PI / 2;
      const lens = cyl(`nvg-lens-${idx}`, ox, 1.74, 0.395, 0.045, 0.016, skin.accent, "glow", 8);
      lens.rotation.x = Math.PI / 2;
    }
  }
  if (skin.gear === "riot") {
    const k6 = sphere("riot-helmet", 0, 1.81, -0.01, 0.53, skin.trim, "armor", 10);
    k6.scaling.set(1.05, 0.74, 1.08);
    box("riot-shield", 0, 1.71, 0.26, 0.45, 0.22, 0.04, skin.accent, "metal");
    box("riot-collar", 0, 1.42, 0, 0.62, 0.16, 0.54, skin.trim, "armor");
    box("riot-pauldron-l", -0.45, 1.29, 0, 0.24, 0.2, 0.34, skin.trim, "armor");
    box("riot-pauldron-r", 0.45, 1.29, 0, 0.24, 0.2, 0.34, skin.trim, "armor");
  }
  if (skin.gear === "ghillie") {
    box("ghillie-hood", 0, 1.81, -0.04, 0.52, 0.28, 0.5, skin.trim, "cloth");
    box("ghillie-mantle", 0, 1.32, -0.22, 0.72, 0.46, 0.26, skin.trim, "cloth");
    box("ghillie-fringe-l", -0.34, 1.34, 0.04, 0.2, 0.24, 0.44, skin.accent, "cloth");
    box("ghillie-fringe-r", 0.34, 1.34, 0.04, 0.2, 0.24, 0.44, skin.accent, "cloth");
    cyl("sniper-optic-l", -0.09, 1.7, 0.24, 0.09, 0.05, darkKit, "metal", 8).rotation.x = Math.PI / 2;
    cyl("sniper-optic-r", 0.09, 1.7, 0.24, 0.09, 0.05, darkKit, "metal", 8).rotation.x = Math.PI / 2;
  }
  if (skin.gear === "beret") {
    const beret = cyl("beret-cap", -0.03, 1.86, -0.01, 0.48, 0.11, skin.body, "cloth", 12);
    beret.rotation.z = 0.22;
    box("beret-badge", 0.09, 1.83, 0.22, 0.07, 0.07, 0.03, skin.trim, "metal");
    box("beret-earpiece-l", -0.25, 1.69, 0, 0.06, 0.14, 0.12, darkKit, "metal");
    box("beret-earpiece-r", 0.25, 1.69, 0, 0.06, 0.14, 0.12, darkKit, "metal");
  }
  if (skin.gear === "skullmask") {
    box("skull-hood", 0, 1.81, -0.04, 0.49, 0.24, 0.46, skin.body, "cloth");
    box("skull-jaw", 0, 1.56, 0.235, 0.32, 0.16, 0.035, skin.accent, "armor");
    box("skull-shades", 0, 1.7, 0.24, 0.38, 0.075, 0.035, "#0d1117", "metal");
    box("skull-headset-band", 0, 1.89, 0, 0.49, 0.04, 0.06, darkKit, "metal");
  }
  if (skin.gear === "exovisor") {
    const cmd = sphere("exo-helmet", 0, 1.82, -0.01, 0.5, skin.trim, "armor", 10);
    cmd.scaling.set(1.04, 0.68, 1.08);
    box("exo-hud-lens", 0.09, 1.7, 0.245, 0.18, 0.09, 0.035, skin.accent, "glow");
    box("exo-spine", 0, 1.08, -0.43, 0.14, 0.56, 0.1, skin.trim, "metal");
    box("exo-sternum", 0, 1.07, 0.41, 0.3, 0.3, 0.04, skin.trim, "metal");
  }
  if (skin.gear === "headset") {
    const fast = sphere("fast-helmet", 0, 1.82, -0.01, 0.5, skin.trim, "armor", 10);
    fast.scaling.set(1.02, 0.64, 1.06);
    box("fast-rail-l", -0.26, 1.77, 0.02, 0.035, 0.06, 0.28, skin.accent, "metal");
    box("fast-rail-r", 0.26, 1.77, 0.02, 0.035, 0.06, 0.28, skin.accent, "metal");
    cyl("peltor-l", -0.25, 1.69, 0, 0.13, 0.07, darkKit, "armor", 8).rotation.z = Math.PI / 2;
    cyl("peltor-r", 0.25, 1.69, 0, 0.13, 0.07, darkKit, "armor", 8).rotation.z = Math.PI / 2;
    box("ksk-shemagh", 0, 1.43, 0.06, 0.5, 0.15, 0.45, skin.accent, "cloth");
  }
  if (skin.gear === "juggernaut") {
    const jug = sphere("jug-helmet", 0, 1.82, -0.01, 0.54, skin.body, "armor", 10);
    jug.scaling.set(1.06, 0.78, 1.1);
    box("jug-blast-mask", 0, 1.64, 0.255, 0.44, 0.22, 0.06, skin.trim, "armor");
    box("jug-slit", 0, 1.7, 0.288, 0.32, 0.045, 0.02, skin.accent, "glow");
    box("jug-collar", 0, 1.42, 0, 0.68, 0.18, 0.58, skin.trim, "armor");
    box("jug-pauldron-l", -0.47, 1.3, 0, 0.26, 0.24, 0.38, skin.trim, "armor");
    box("jug-pauldron-r", 0.47, 1.3, 0, 0.26, 0.24, 0.38, skin.trim, "armor");
  }

  // Right-hand anchor node for held weapons/knives/grenades/C4 (pitches with look angle!)
  const handAnchor = new TransformNode(`${id}-hand`, scene);
  handAnchor.parent = root;
  handAnchor.position.set(0.32, 0.92, 0.34);

  if (outline) {
    for (const mesh of [body, head]) {
      const shell = MeshBuilder.CreateBox(
        `${id}-${mesh.name}-outline`,
        {
          width: mesh === body ? H.body.radius * 2 : H.head.radius * 2,
          height: mesh === body ? H.body.max - H.body.min : H.head.radius * 2,
          depth: mesh === body ? H.body.radius * 2 : H.head.radius * 2,
          sideOrientation: Mesh.BACKSIDE,
        },
        scene,
      );
      shell.parent = mesh;
      shell.scaling.setAll(1.045);
      const rim = new StandardMaterial(`${id}-outline-${outlineColor}`, scene);
      rim.diffuseColor = Color3.FromHexString(outlineColor);
      rim.emissiveColor = rim.diffuseColor;
      rim.specularColor = Color3.Black();
      rim.disableLighting = true;
      rim.alpha = 1;
      rim.backFaceCulling = true;
      rim.freeze();
      materials.push(rim);
      shell.material = rim;
      shell.isPickable = false;
    }
  }

  const normal = body.material;
  return {
    root,
    body,
    head,
    neck,
    gearRoot,
    handAnchor,
    skin: skinId,
    team,
    flash: (enabled: boolean) => {
      body.material = enabled ? material("#f9e7cf", "glow") : normal;
    },
    dispose: () => {
      root.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
