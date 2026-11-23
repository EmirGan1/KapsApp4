import React, { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Cosmetic } from "../../../games/kapsstrike/cosmetics";
import { RARITIES } from "../../../games/kapsstrike/cosmetics";
import { WEAPONS } from "../../../games/kapsstrike/config";
import type { WeaponId } from "../../../games/kapsstrike/types";
import { buildWeaponModel } from "../../../games/kapsstrike/weaponModels";
import { applyWeaponCosmetic } from "../../../games/kapsstrike/weaponMaterials";
import { WEAPON_PRESENTATION } from "../../../games/kapsstrike/weaponAssets";
import { finishAppearance } from "../../../games/kapsstrike/finishAppearance";

export interface WeaponPreview3DProps {
  weapon: WeaponId;
  item?: Cosmetic | null;
  height?: number;
  className?: string;
  onEquip?: (item: Cosmetic) => void;
  isEquipped?: boolean;
  isOwned?: boolean;
  busy?: boolean;
  chance?: number;
}

const FINISH_KIND_LABELS: Record<string, string> = {
  tactical_camo: "Taktik Kamuflaj",
  anodized_metal: "Eloksallı Metal",
  carbon_fiber: "Karbon Fiber",
  damascus_steel: "Şam Çeliği (Damascus)",
  engraved_gold: "Gravürlü Metalik",
  ceramic_pearl: "Seramik / Sedef",
  collector_fade: "Koleksiyon Gradyan",
  military_polymer: "Askeri Polimer",
};

/**
 * Interactive 360° rotatable 3D weapon and skin showcase powered by the exact same
 * sculpted 3D weapon geometry and shared PBR material resolver used in-game.
 */
export default function WeaponPreview3D({
  weapon,
  item,
  height = 290,
  className = "",
  onEquip,
  isEquipped = false,
  isOwned = false,
  busy = false,
  chance,
}: WeaponPreview3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [autoSpin, setAutoSpin] = useState(true);
  const [showStock, setShowStock] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  const autoSpinRef = useRef(autoSpin);
  autoSpinRef.current = autoSpin;

  const orbitRef = useRef({
    yaw: Math.PI * 0.48,
    pitch: 0.09,
    targetYaw: Math.PI * 0.48,
    targetPitch: 0.09,
    zoom: 1,
    targetZoom: 1,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  const sceneRef = useRef<{
    engine: Engine;
    scene: Scene;
    camera: UniversalCamera;
    pivot: TransformNode;
    rimLight: DirectionalLight;
    ringMat: StandardMaterial;
    modelNode?: TransformNode;
  } | null>(null);

  // Mount WebGL Engine & Studio Scene once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: Engine | null = null;
    try {
      engine = new Engine(canvas, true, {
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    engine.setHardwareScalingLevel(1 / dpr);

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.035, 0.06, 0.105, 1);
    scene.ambientColor = new Color3(0.18, 0.22, 0.28);

    const camera = new UniversalCamera("preview-cam", new Vector3(0, 0.18, -1.5), scene);
    camera.minZ = 0.05;
    camera.maxZ = 30;
    camera.fov = 0.68;
    camera.setTarget(Vector3.Zero());

    // 3-point studio PBR lighting
    const hemi = new HemisphericLight("preview-hemi", new Vector3(0.15, 1, 0.2), scene);
    hemi.intensity = 1.05;
    hemi.diffuse = new Color3(0.92, 0.96, 1.0);
    hemi.groundColor = new Color3(0.24, 0.28, 0.35);

    const key = new DirectionalLight("preview-key", new Vector3(-0.45, -0.7, 0.72), scene);
    key.intensity = 1.65;
    key.diffuse = new Color3(1.0, 0.97, 0.92);
    key.specular = new Color3(1.0, 0.98, 0.96);

    const rim = new DirectionalLight("preview-rim", new Vector3(0.65, -0.28, -0.82), scene);
    rim.intensity = 1.15;
    rim.diffuse = new Color3(0.55, 0.84, 1.0);
    rim.specular = new Color3(0.75, 0.92, 1.0);

    // Subtle brushed studio pedestal ring under weapon
    const ring = MeshBuilder.CreateTorus(
      "preview-ring",
      { diameter: 0.95, thickness: 0.01, tessellation: 40 },
      scene,
    );
    ring.position.set(0, -0.22, 0);
    const ringMat = new StandardMaterial("preview-ring-mat", scene);
    ringMat.diffuseColor = Color3.FromHexString("#38bdf8");
    ringMat.emissiveColor = Color3.FromHexString("#38bdf8").scale(0.55);
    ringMat.disableLighting = true;
    ring.material = ringMat;

    const pivot = new TransformNode("preview-weapon-pivot", scene);
    sceneRef.current = { engine, scene, camera, pivot, rimLight: rim, ringMat };

    let last = performance.now();
    const renderFrame = () => {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;

      const o = orbitRef.current;
      if (autoSpinRef.current && !o.dragging) {
        o.targetYaw += dt * 0.22;
      }
      const damp = 1 - Math.exp(-10 * dt);
      o.yaw += (o.targetYaw - o.yaw) * damp;
      o.pitch += (o.targetPitch - o.pitch) * damp;
      o.zoom += (o.targetZoom - o.zoom) * damp;

      pivot.rotation.y = o.yaw;
      pivot.rotation.x = o.pitch;
      pivot.scaling.setAll(o.zoom);

      scene.render();
    };

    engine.runRenderLoop(renderFrame);

    const ro = new ResizeObserver(() => {
      engine?.resize();
    });
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      engine?.stopRenderLoop(renderFrame);
      scene.dispose();
      engine?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Rebuild/swap weapon mesh and apply cosmetic finish whenever weapon, item, or stock toggle changes
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const { scene, camera, pivot, rimLight, ringMat } = ctx;

    if (ctx.modelNode) {
      ctx.modelNode.dispose();
      ctx.modelNode = undefined;
    }

    const activeFinish = showStock ? undefined : item ?? undefined;
    const activeWeapon = item?.weapon ?? weapon;
    const spec = WEAPON_PRESENTATION[activeWeapon] || WEAPON_PRESENTATION.rifle;

    const model = buildWeaponModel(scene, activeWeapon, {
      detail: "fp",
      quality: "high",
      prefix: `preview-${activeWeapon}-`,
      knifeStyle: activeFinish?.knife ?? item?.knife ?? "default",
    });

    // For straight knives in preview, disable gloved hands so the blade & grip inspect cleanly
    if (activeWeapon === "knife") {
      for (const m of model.getChildMeshes()) {
        if (/palm|wrist|finger|thumb|glove/.test(m.name)) {
          m.setEnabled(false);
        }
      }
    }

    applyWeaponCosmetic(model, activeWeapon, activeFinish, scene, "high");
    model.parent = pivot;
    // Center the weapon visually around the turntable pivot
    model.position.set(0, -spec.previewTargetY, -spec.previewTargetZ);
    ctx.modelNode = model;

    // Frame camera specifically to this weapon archetype
    camera.position.set(0, 0.16, -spec.previewRadius);
    camera.setTarget(new Vector3(0, 0, 0));

    // Accentuate rim light & studio ring with skin rarity color
    const accentHex = activeFinish ? RARITIES[activeFinish.rarity].color : "#38bdf8";
    const accentColor = Color3.FromHexString(accentHex);
    rimLight.diffuse = Color3.Lerp(new Color3(0.55, 0.8, 1.0), accentColor, 0.55);
    ringMat.diffuseColor = accentColor;
    ringMat.emissiveColor = accentColor.scale(0.55);

    // Reset to crisp CS-style 3/4 side silhouette whenever switching weapon/skin
    orbitRef.current.yaw = Math.PI * 0.48;
    orbitRef.current.targetYaw = Math.PI * 0.48;
    orbitRef.current.pitch = 0.09;
    orbitRef.current.targetPitch = 0.09;
    orbitRef.current.targetZoom = 1;
  }, [weapon, item, showStock]);

  const activeWeapon = item?.weapon ?? weapon;
  const spec = WEAPON_PRESENTATION[activeWeapon] || WEAPON_PRESENTATION.rifle;
  const appearance = item ? finishAppearance(item) : null;
  const rarityInfo = item ? RARITIES[item.rarity] : null;

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    orbitRef.current.dragging = true;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!orbitRef.current.dragging) return;
    const dx = e.clientX - orbitRef.current.lastX;
    const dy = e.clientY - orbitRef.current.lastY;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
    orbitRef.current.targetYaw -= dx * 0.011;
    orbitRef.current.targetPitch = Math.max(
      -0.85,
      Math.min(0.85, orbitRef.current.targetPitch + dy * 0.009),
    );
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    orbitRef.current.dragging = false;
  };

  const adjustZoom = (delta: number) => {
    orbitRef.current.targetZoom = Math.max(
      0.7,
      Math.min(1.55, orbitRef.current.targetZoom + delta),
    );
  };

  const resetOrbit = () => {
    orbitRef.current.targetYaw = Math.PI * 0.42;
    orbitRef.current.targetPitch = 0.12;
    orbitRef.current.targetZoom = 1;
  };

  return (
    <section
      className={`ks-preview3d ${className}`}
      style={{ "--rarity": rarityInfo?.color || "#38bdf8" } as React.CSSProperties}
      aria-label="3D Silah ve Kaplama İnceleme"
    >
      <div className="ks-preview3d-stage" style={{ height }}>
        {webglFailed ? (
          <div className="ks-preview3d-fallback">
            <p>3D önizleme bu tarayıcıda kullanılamıyor.</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            data-testid="weapon-preview-3d-canvas"
            className="ks-preview3d-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label={`${WEAPONS[activeWeapon]?.name || activeWeapon} ${item?.name || "Standart"} 3D modeli`}
          />
        )}
        <div className="ks-preview3d-hint" aria-hidden="true">
          360° çevirmek için sürükle
        </div>
        <div className="ks-preview3d-controls">
          <button
            type="button"
            aria-label="Yakınlaştır"
            onClick={() => adjustZoom(0.15)}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Uzaklaştır"
            onClick={() => adjustZoom(-0.15)}
          >
            −
          </button>
          <button
            type="button"
            aria-pressed={autoSpin}
            onClick={() => setAutoSpin((v) => !v)}
          >
            {autoSpin ? "Dönüş: Açık" : "Dönüş: Kapalı"}
          </button>
          {item && (
            <button
              type="button"
              aria-pressed={showStock}
              onClick={() => setShowStock((v) => !v)}
            >
              {showStock ? "Kaplamayı Göster" : "Orijinal"}
            </button>
          )}
          <button type="button" onClick={resetOrbit}>
            Sıfırla
          </button>
        </div>
      </div>

      <div className="ks-preview3d-meta">
        <div>
          <span className="ks-preview3d-weapon">
            {WEAPONS[activeWeapon]?.name || activeWeapon}
            {item?.knife ? ` · ${item.knife.toUpperCase()}` : ""}
          </span>
          <h3>{item ? item.name : "Standart Donanım"}</h3>
          <small>
            {spec.archetype}
            {appearance ? ` · ${FINISH_KIND_LABELS[appearance.materialKind] || "PBR Kaplama"}` : ""}
            {typeof chance === "number" && chance > 0
              ? ` · Şans: %${chance.toLocaleString("tr-TR", { maximumFractionDigits: 3 })}`
              : ""}
          </small>
        </div>
        <div className="ks-preview3d-actions">
          {rarityInfo && (
            <span className="ks-preview3d-rarity" style={{ color: rarityInfo.color }}>
              {rarityInfo.name}
            </span>
          )}
          {item && isOwned && onEquip && (
            <button
              type="button"
              className="ks-primary"
              disabled={busy || isEquipped}
              onClick={() => onEquip(item)}
            >
              {isEquipped ? "Kuşanıldı" : "Kuşan"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
