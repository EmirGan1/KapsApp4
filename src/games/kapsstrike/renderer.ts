import { createCharacter } from "./character";
import { cleanSkin } from "./skins";
import { surfaceTexture } from "./surfaceTextures";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import {
  MapDefinition,
  StrikeSettings,
  TrainingState,
  CombatEvent,
  WeaponId,
  Vec3,
  Solid,
} from "./types";
import { WEAPONS, WEAPON_ORDER, PHYSICS as C, TARGET_HITBOXES, detectAutoQuality } from "./config";
import { raySolid, clamp, collisionSolids } from "./physics";
import { aimDirection } from "./combat";
/** All input belongs to StrikeController; avoid a second device/gamepad listener graph. */
class StrikeScene extends Scene {
  override attachControl(): void {}
}
export class StrikeRenderer {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: UniversalCamera;
  private materials = new Map<string, StandardMaterial>();
  private targetMeshes = new Map<
    string,
    { root: TransformNode; body: Mesh; head: Mesh }
  >();
  private remotePlayerMeshes = new Map<
    string,
    {
      model: ReturnType<typeof createCharacter>;
      skin: string;
      team: string;
      root: TransformNode;
      body: Mesh;
      head: Mesh;
      tagPlane?: Mesh;
      gun?: Mesh;
      tagTex?: DynamicTexture;
      tagMat?: StandardMaterial;
    }
  >();
  private flashes = new Map<string, number>();
  private gunRoot: TransformNode;
  private weapons = new Map<WeaponId, TransformNode>();
  private tracerPool: { mesh: Mesh; until: number }[] = [];
  private impactPool: { mesh: Mesh; until: number }[] = [];
  private poolIndex = 0;
  private gunKick = 0;
  private reloadAt = 0;
  private muzzle: Mesh;
  private shadow?: ShadowGenerator;
  private observer?: ResizeObserver;
  private lastEvent = 0;
  private frameDrawCalls = 0;
  private previousDrawCalls = 0;
  private settings: StrikeSettings;
  private dynamicScale=1;
  private scaleTimer=performance.now();
  private slowSamples=0;
  private fastSamples=0;
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly map: MapDefinition,
    settings: StrikeSettings,
    injectedEngine?: Engine,
  ) {
    this.settings = settings;
    const effectiveQuality = settings.quality === "auto" ? detectAutoQuality() : settings.quality;
    this.engine =
      injectedEngine ||
      new Engine(
        canvas,
        effectiveQuality !== "low",
        {
          preserveDrawingBuffer: false,
          stencil: true,
          powerPreference: "high-performance",
          adaptToDeviceRatio: false,
        },
        false,
      );
    try {
      this.scene = new StrikeScene(this.engine);
      this.scene.clearColor = Color4.FromHexString(map.sky + "ff");
      this.scene.fogMode = Scene.FOGMODE_LINEAR;
      this.scene.fogStart = 68;
      this.scene.fogEnd = 175;
      this.scene.fogColor = Color3.FromHexString(map.sky);
      this.scene.skipPointerMovePicking = true;
      this.scene.autoClear = true;
      const hemi = new HemisphericLight(
        "sky",
        new Vector3(0.2, 1, 0.3),
        this.scene,
      );
      hemi.intensity = map.id === "neon" ? 0.5 : 0.6;
      const sun = new DirectionalLight(
        "sun",
        new Vector3(-0.4, -1, 0.3),
        this.scene,
      );
      sun.position.set(15, 35, -20);
      sun.intensity = map.id === "neon" ? 0.45 : 0.65;
      if (effectiveQuality === "high") {
        this.shadow = new ShadowGenerator(1024, sun);
        this.shadow.usePoissonSampling = true;
      }
      this.camera = new UniversalCamera(
        "eyes",
        new Vector3(0, 1.62, -28),
        this.scene,
      );
      this.camera.minZ = 0.035;
      this.camera.maxZ = 220;
      this.camera.inputs.clear();
      this.camera.fov = (settings.fov * Math.PI) / 180;
      this.scene.activeCamera = this.camera;
      const ground = MeshBuilder.CreateGround(
        "ground",
        { width: 320, height: 320 },
        this.scene,
      );
      ground.material = this.material(map.floor,false,map.id==='dust'?'plaster':'concrete');
      this.worldUV(ground);
      ground.receiveShadows = true;
      const batches = new Map<StandardMaterial, Mesh[]>();
      for (const s of map.solids) {
        if(s.hidden)continue;
        if(effectiveQuality==='low'&&s.detail&&(Math.abs(s.x)>40||Math.abs(s.z)>40)&&Math.max(s.w,s.h,s.d)<8)continue;
        let mesh: Mesh | ReturnType<Mesh["createInstance"]>;
        if (s.kind === "ramp") {
          const x = s.w / 2,
            z = s.d / 2,
            heights = s.axis === "x" ? [0, s.h, s.h, 0] : [0, 0, s.h, s.h];
          const positions = [
            -x,
            0,
            -z,
            x,
            0,
            -z,
            x,
            0,
            z,
            -x,
            0,
            z,
            -x,
            heights[0],
            -z,
            x,
            heights[1],
            -z,
            x,
            heights[2],
            z,
            -x,
            heights[3],
            z,
          ];
          const indices = [
            4, 7, 6, 4, 6, 5, 0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6,
            2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
          ];
          const normals: number[] = [];
          VertexData.ComputeNormals(positions, indices, normals);
          const data = new VertexData();
          data.positions = positions;
          data.uvs = new Array(positions.length / 3 * 2).fill(0);
          data.indices = indices;
          data.normals = normals;
          mesh = new Mesh(s.id, this.scene);
          data.applyToMesh(mesh);
          mesh.convertToFlatShadedMesh();
          mesh.material = this.material(s.color,!!s.glow,s.surface,s.label);
        } else {
          mesh = s.shape ? MeshBuilder.CreateCylinder(s.id,{height:s.h,diameter:s.w,diameterTop:s.shape==='cone'?0:s.w,tessellation:s.shape==='cone'?8:12},this.scene) : MeshBuilder.CreateBox(s.id,{width:s.w,height:s.h,depth:s.d},this.scene);
          if(s.shape)mesh.scaling.z=s.d/s.w;
          mesh.material = this.material(s.color,!!s.glow,s.surface,s.label);
        }
        if(s.surface&&!s.label&&!s.shape)this.worldUV(mesh as Mesh);
        mesh.position.set(s.x, s.y + (s.kind === "box" ? s.h / 2 : 0), s.z);
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        const material=mesh.material as StandardMaterial;
        const group=batches.get(material) || [];group.push(mesh as Mesh);batches.set(material,group);
      }
      // Small authored districts are geometry-light: one static batch per material
      // trades fine-grained culling for substantially fewer draw calls.
      for(const [material,meshes] of batches){
        const batch=Mesh.MergeMeshes(meshes,true,true)!;
        batch.name="district-"+material.name;batch.material=material;
        batch.receiveShadows=true;batch.isPickable=false;batch.freezeWorldMatrix();
        this.shadow?.addShadowCaster(batch);
      }
      const hazard = MeshBuilder.CreateCylinder(
        "hazard",
        { diameter: map.hazard.r * 2, height: 0.04, tessellation: 24 },
        this.scene,
      );
      hazard.position.set(map.hazard.x, 0.025, map.hazard.z);
      hazard.material = this.material("#dd643f", true);
      for (const t of map.targets) {
        const root = new TransformNode(t.id, this.scene);
        const body = MeshBuilder.CreateBox(
          t.id + "-body",
          {
            width: TARGET_HITBOXES.body.radius * 2,
            height: TARGET_HITBOXES.body.max - TARGET_HITBOXES.body.min,
            depth: TARGET_HITBOXES.body.radius * 2,
          },
          this.scene,
        );
        body.position.y =
          (TARGET_HITBOXES.body.min + TARGET_HITBOXES.body.max) / 2;
        body.parent = root;
        body.material = this.material("#edb96b");
        const head = MeshBuilder.CreateBox(
          t.id + "-head",
          { size: TARGET_HITBOXES.head.radius * 2 },
          this.scene,
        );
        head.position.y =
          (TARGET_HITBOXES.head.min + TARGET_HITBOXES.head.max) / 2;
        head.parent = root;
        head.material = this.material("#f5e1b5");
        const stand = MeshBuilder.CreateCylinder(
          t.id + "-stand",
          { diameter: 0.85, height: 0.12, tessellation: 8 },
          this.scene,
        );
        stand.parent = root;
        stand.material = this.material("#263645");
        stand.position.y = 0.06;
        this.targetMeshes.set(t.id, { root, body, head });
        this.shadow?.addShadowCaster(body);
        this.shadow?.addShadowCaster(head);
      }
      this.scene.setRenderingAutoClearDepthStencil(2, true, true, true);
      this.gunRoot = new TransformNode("viewmodel", this.scene);
      this.gunRoot.parent = this.camera;
      for (const id of WEAPON_ORDER) {
        const w = WEAPONS[id],
          root = new TransformNode(id, this.scene);
        root.parent = this.gunRoot;
        const part = (
          name: string,
          x: number,
          y: number,
          z: number,
          width: number,
          height: number,
          depth: number,
          color: string,
        ) => {
          const m = MeshBuilder.CreateBox(
            id + name,
            { width, height, depth },
            this.scene,
          );
          m.position.set(x, y, z);
          m.parent = root;
          m.material = this.material(color);
          m.renderingGroupId = 2;
          m.isPickable = false;
          return m;
        };
        if (id === "knife") {
          part("handle",0,-0.04,-0.1,0.09,0.12,0.23,"#26313c");
          part("guard",0,0,0.015,0.22,0.035,0.045,"#637b8c");
          const blade = part("blade",0,0.015,0.21,0.075,0.025,0.35,"#d8e3e9");
          blade.rotation.z = 0.15;
          this.weapons.set(id,root);
          continue;
        }
        part("receiver", 0, 0, 0, 0.14, 0.17, w.length * 0.43, w.color);
        part(
          "barrel",
          0,
          0.02,
          w.length * 0.4,
          0.055,
          0.055,
          w.length * 0.5,
          "#26313c",
        );
        part("grip", 0, -0.15, -0.06, 0.09, 0.22, 0.1, "#273442");
        if (id !== "pistol")
          part(
            "stock",
            0,
            -0.02,
            -w.length * 0.33,
            0.13,
            0.12,
            Math.max(0.25, w.length * 0.24),
            "#334351",
          );
        part(
          "front-sight",
          0,
          0.095,
          w.length * 0.53,
          0.025,
          0.095,
          0.045,
          "#121b23",
        );
        part("rear-sight-base", 0, 0.095, -0.12, 0.09, 0.02, 0.035, "#17222d");
        part(
          "rear-sight-left",
          -0.035,
          0.125,
          -0.12,
          0.02,
          0.08,
          0.035,
          "#17222d",
        );
        part(
          "rear-sight-right",
          0.035,
          0.125,
          -0.12,
          0.02,
          0.08,
          0.035,
          "#17222d",
        );
        if (id === "sniper") {
          part("scope-mount-front", 0, 0.11, 0.1, 0.07, 0.06, 0.04, "#273442");
          part("scope-mount-back", 0, 0.11, -0.1, 0.07, 0.06, 0.04, "#273442");
          part("scope", 0, 0.19, 0, 0.1, 0.1, 0.35, "#223845");
          part("lens", 0, 0.19, 0.18, 0.08, 0.08, 0.012, "#7ac4de");
        }
        if (id === "shotgun")
          part("pump", 0, -0.04, w.length * 0.22, 0.11, 0.1, 0.22, "#675344");
        if (id === "rifle" || id === "smg")
          part("magazine", 0, -0.18, 0.02, 0.08, 0.26, 0.13, "#293844");
        this.weapons.set(id, root);
      }
      this.muzzle = MeshBuilder.CreateSphere(
        "muzzle",
        { diameter: 0.11, segments: 4 },
        this.scene,
      );
      this.muzzle.parent = this.gunRoot;
      this.muzzle.position.set(0, 0.02, 0.75);
      this.muzzle.material = this.material("#ffdd94", true);
      this.muzzle.renderingGroupId = 2;
      this.muzzle.setEnabled(false);
      for (let i = 0; i < 48; i++) {
        const mesh = MeshBuilder.CreateLines(
          "tracer" + i,
          { points: [Vector3.Zero(), new Vector3(0, 0, 1)], updatable: true },
          this.scene,
        );
        mesh.color = new Color3(1, 0.82, 0.45);
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.isPickable = false;
        mesh.setEnabled(false);
        this.tracerPool.push({ mesh, until: 0 });
        const impact = MeshBuilder.CreateSphere(
          "impact" + i,
          { diameter: 0.09, segments: 3 },
          this.scene,
        );
        impact.material = this.material("#ffe7ba", true);
        impact.isPickable = false;
        impact.setEnabled(false);
        this.impactPool.push({ mesh: impact, until: 0 });
      }
      if (!injectedEngine) {
        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(canvas);
      }
      this.engine.onContextLostObservable.add(() => {
        canvas.dispatchEvent(new Event("strike-context-lost"));
      });
    } catch (error) {
      this.observer?.disconnect();
      this.engine.dispose();
      throw error;
    }
  }
  private worldUV(mesh:Mesh){
    const positions=mesh.getVerticesData(VertexBuffer.PositionKind),normals=mesh.getVerticesData(VertexBuffer.NormalKind);
    if(!positions||!normals)return;
    const uv:number[]=[];
    for(let i=0;i<positions.length;i+=3){
      const nx=Math.abs(normals[i]),ny=Math.abs(normals[i+1]);
      uv.push((nx>.5?positions[i+2]:positions[i])/2,(ny>.5?positions[i+2]:positions[i+1])/2);
    }
    mesh.setVerticesData(VertexBuffer.UVKind,uv);
  }
  private material(color: string, emissive = false, surface?:Solid['surface'],label?:string) {
    const key = color + emissive + (surface||'') + (label||'');
    let m = this.materials.get(key);
    if (!m) {
      m = new StandardMaterial(key, this.scene);
      m.diffuseColor = Color3.FromHexString(color);
      const texture=surfaceTexture(this.scene,key,color,surface,label);
      if(texture){m.diffuseTexture=texture;m.diffuseColor=Color3.White();}
      m.specularColor = color === "#253140" ? new Color3(.22,.25,.3) : new Color3(0.035, 0.035, 0.035);
      if(surface==='water'||surface==='glass') {m.specularColor=new Color3(.45,.52,.57);m.specularPower=64;}
      if(color === "#253140")m.specularPower=64;
      if (emissive) {
        m.emissiveColor = m.diffuseColor;
        if(texture)m.emissiveTexture=texture;
        m.disableLighting = true;
      }
      m.freeze();
      this.materials.set(key, m);
    }
    return m;
  }
  private resize() {
    const dpr = Math.min(
      devicePixelRatio || 1,
      this.settings.quality === "high" ? 2 : (this.settings.quality === "low" || this.settings.quality === "auto" && detectAutoQuality() === "low") ? 1 : 1.5,
    );
    this.engine.setHardwareScalingLevel(1 / (dpr * this.settings.scale * this.dynamicScale));
    this.engine.resize();
  }
  process(events: CombatEvent[], localActor?: string, predicted=false) {
    for (const e of events) {
      if (!predicted && e.id <= this.lastEvent) continue;
      if (!predicted) this.lastEvent = e.id;
      if (e.kind === "hit" && e.target && this.remotePlayerMeshes.has(e.target)) this.flashes.set(e.target, performance.now() + 120);
      if (e.kind === "shot" && e.from && e.to) {
        if (!localActor || e.actor === localActor) this.gunKick = 0.06;
        const item = this.tracerPool[this.poolIndex % 48],
          impact = this.impactPool[this.poolIndex++ % 48];
        const positions = new Float32Array([
          e.from.x,
          e.from.y,
          e.from.z,
          e.to.x,
          e.to.y,
          e.to.z,
        ]);
        item.mesh.updateVerticesData(
          VertexBuffer.PositionKind,
          positions,
          true,
        );
        item.mesh.setEnabled(true);
        item.until = e.tick + 7;
        impact.mesh.position.set(e.to.x, e.to.y, e.to.z);
        impact.mesh.setEnabled(true);
        impact.until = e.tick + 12;
        if (!localActor || e.actor === localActor) this.muzzle.setEnabled(true);
      }
      if (e.kind === "reload" && (!localActor || e.actor === localActor)) this.reloadAt = e.tick;
    }
  }
  render(
    state: TrainingState,
    yaw: number,
    pitch: number,
    ads: boolean,
    alpha: number,
    previous: Vec3,
    delta: number,
  ) {
    const p = state.player,
      m = p.movement;
    this.camera.position.set(
      previous.x + (m.position.x - previous.x) * alpha,
      m.position.y + (m.stance === "stand" ? C.eye : C.crouchEye),
      previous.z + (m.position.z - previous.z) * alpha,
    );
    const hurtAge = (state.tick - state.lastDamageTick) * C.dt;
    this.camera.rotation.set(pitch, yaw, hurtAge >= 0 && hurtAge < .12 ? Math.sin(hurtAge * 60) * .008 : 0);
    this.camera.fov +=
      (((this.settings.fov * Math.PI) / 180) *
        (ads ? WEAPONS[p.weapon.selected].zoom : 1) -
        this.camera.fov) *
      Math.min(1, delta * 15);
    this.gunKick = Math.max(0, this.gunKick - delta * 0.4);
    const reload = p.weapon.reloadUntil
      ? Math.sin(
          clamp(
            (state.tick - this.reloadAt) /
              Math.max(1, p.weapon.reloadUntil - this.reloadAt),
            0,
            1,
          ) * Math.PI,
        )
      : 0;
    const dir = aimDirection(yaw, pitch);
    let wall = 1;
    for (const s of collisionSolids(this.map))
      if (!s.detail)
        wall = Math.min(wall, raySolid(this.camera.position, dir, s, 1));
    const near = clamp(1 - wall, 0, 1);
    this.gunRoot.position.set(
      ads ? 0.015 : 0.27,
      -0.26 - reload * 0.25,
      0.52 - this.gunKick - near * 0.2,
    );
    this.gunRoot.rotation.set(
      reload * 0.6 - near * 0.4,
      0,
      Math.sin(state.tick * 0.08) *
        Math.hypot(m.velocity.x, m.velocity.z) *
        0.001,
    );
    this.gunRoot.scaling.setAll(ads ? 0.85 : 1);
    for (const [id, mesh] of this.weapons)
      mesh.setEnabled(id === p.weapon.selected);
    for (const [id, target] of this.targetMeshes) {
      if (!state.targets.some(t => t.id === id)) target.root.setEnabled(false);
    }
    if (state.targets) {
      for (const t of state.targets) {
        const mesh = this.targetMeshes.get(t.id);
        if (mesh) {
          mesh.root.position.set(t.position.x, t.position.y, t.position.z);
          mesh.root.setEnabled(t.hp > 0);
        }
      }
    }
    this.muzzle.position.z = WEAPONS[p.weapon.selected].length * 0.65 + 0.04;
    this.muzzle.setEnabled(p.weapon.selected !== "knife" && this.gunKick > 0.045);
    if (p.weapon.selected === "knife") this.gunRoot.rotation.z += Math.sin(this.gunKick / 0.06 * Math.PI) * 0.9;
    for (const a of this.tracerPool)
      if (a.until < state.tick) a.mesh.setEnabled(false);
    for (const a of this.impactPool)
      if (a.until < state.tick) a.mesh.setEnabled(false);
    this.scene.render();
    if(this.observer && this.settings.dynamicResolution && performance.now()-this.scaleTimer>1500){
      this.scaleTimer=performance.now();const fps=this.engine.getFps();
      this.slowSamples=fps<45 ? this.slowSamples+1:0;
      this.fastSamples=fps>58 ? this.fastSamples+1:0;
      const before=this.dynamicScale;
      if(this.slowSamples>=2){this.dynamicScale=Math.max(.65,this.dynamicScale-.1);this.slowSamples=0;}
      else if(this.fastSamples>=4){this.dynamicScale=Math.min(1,this.dynamicScale+.05);this.fastSamples=0;}
      if(before!==this.dynamicScale)this.resize();
    }
    const draws = this.engine._drawCalls.current;
    this.frameDrawCalls = Math.max(0, draws - this.previousDrawCalls);
    this.previousDrawCalls = draws;
  }
  renderRemotePlayers(
    players: Array<{
      id: string;
      username: string;
      team?: string;
      color?: string;
      position: Vec3;
      yaw: number;
      pitch: number;
      hp: number;
      stance?: string;
      selectedWeapon?: WeaponId;
      skin?: string;
    }>,
    localPlayerId?: string,
    localTeam?: string
  ) {
    const activeIds = new Set<string>();

    for (const p of players) {
      if (p.id === localPlayerId) continue;
      activeIds.add(p.id);

      let item = this.remotePlayerMeshes.get(p.id);
      if (item && (item.skin !== cleanSkin(p.skin) || item.team !== (p.team || "none"))) {
        item.tagTex?.dispose();item.tagMat?.dispose();item.model.dispose();this.remotePlayerMeshes.delete(p.id);item=undefined;
      }
      if (!item) {
        const teamColor =
          p.team === "red"
            ? "#ef4444"
            : p.team === "blue"
              ? "#3b82f6"
              : p.color || "#10b981";

        const teammate = !!localTeam && localTeam !== "none" && p.team === localTeam;
        const rim = teammate ? "#48c7ff" : "#ff315d";
        // The silhouette stays readable on Low settings too. It remains depth-tested,
        // so walls still correctly occlude players.
        const model = createCharacter(this.scene,p.id,p.skin,p.team || "none",true,rim);
        const {root,body,head} = model;
        body.name = "remote-body-" + p.id;
        head.name = "remote-head-" + p.id;

        const tagPlane = MeshBuilder.CreatePlane(
          "remote-tag-" + p.id,
          { width: 1.2, height: 0.28 },
          this.scene
        );
        tagPlane.position.y = TARGET_HITBOXES.head.max + 0.35;
        tagPlane.parent = root;
        tagPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;

        const tagTex = new DynamicTexture(
          "remote-tag-tex-" + p.id,
          { width: 256, height: 64 },
          this.scene,
          false
        );
        tagTex.hasAlpha = true;
        const displayName = (p.username || "Oyuncu").slice(0, 16);
        tagTex.drawText(displayName, null, 42, "bold 26px monospace", "#ffffff", teamColor, true);

        const tagMat = new StandardMaterial("remote-tag-mat-" + p.id, this.scene);
        tagMat.diffuseTexture = tagTex;
        tagMat.emissiveColor = Color3.White();
        tagMat.disableLighting = true;
        tagPlane.material = tagMat;

        const gun = MeshBuilder.CreateBox(
          "remote-gun-" + p.id,
          { width: 0.08, height: 0.12, depth: 0.45 },
          this.scene
        );
        gun.position.set(0.25, 0.9, 0.25);
        gun.parent = root;
        gun.material = this.material("#1e293b");

        item = { model, skin:cleanSkin(p.skin), team:p.team || "none", root, body, head, tagPlane, gun, tagTex, tagMat };
        this.remotePlayerMeshes.set(p.id, item);
      }

      item.model.flash((this.flashes.get(p.id) || 0) > performance.now());
      const isAlive = p.hp > 0;
      item.root.setEnabled(isAlive);
      if (isAlive) {
        item.root.position.set(p.position.x, p.position.y, p.position.z);
        item.root.rotation.y = p.yaw;
        item.head.rotation.x = p.pitch;
        if (item.gun) {
          item.gun.scaling.set(p.selectedWeapon === "knife" ? 0.5 : 1, p.selectedWeapon === "knife" ? 0.22 : 1, 1);
          item.gun.material = this.material(p.selectedWeapon === "knife" ? "#d8e3e9" : "#1e293b");
        }

        const isCrouch = p.stance === "crouch" || p.stance === "slide";
        const offset = isCrouch ? C.standing - C.crouching : 0;
        item.model.gearRoot.scaling.y = isCrouch ? C.crouching / C.standing : 1;
        const low = Math.max(0.08, TARGET_HITBOXES.body.min - offset);
        const high = TARGET_HITBOXES.body.max - offset;
        item.body.scaling.y = (high - low) / (TARGET_HITBOXES.body.max - TARGET_HITBOXES.body.min);
        item.body.position.y = (low + high) / 2;
        item.head.position.y = (TARGET_HITBOXES.head.min + TARGET_HITBOXES.head.max) / 2 - offset;
      }
    }

    for (const [id, item] of this.remotePlayerMeshes.entries()) {
      if (!activeIds.has(id)) {
        item.tagTex?.dispose();
        item.tagMat?.dispose();
        item.model.dispose();
        this.flashes.delete(id);
        this.remotePlayerMeshes.delete(id);
      }
    }
  }
  stats() {
    return {
      fps: this.engine.getFps(),
      drawCalls: this.frameDrawCalls,
      meshes: this.scene.meshes.length,
      activeMeshes: this.scene.getActiveMeshes().length,
    };
  }
  dispose() {
    this.observer?.disconnect();
    this.shadow?.dispose();
    this.scene.dispose();
    this.engine.dispose();
    this.materials.clear();
    this.tracerPool = [];
    this.impactPool = [];
    for (const p of this.remotePlayerMeshes.values()) {
      p.tagTex?.dispose();
      p.tagMat?.dispose();
      p.model.dispose();
    }
    this.remotePlayerMeshes.clear();
    this.flashes.clear();
  }
}
