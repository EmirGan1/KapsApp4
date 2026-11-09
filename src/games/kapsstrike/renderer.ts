import {straightKnifeMotion} from "./knifeMotion";
import {finishAppearance,finishTextureUrl} from "./finishAppearance";
import {BombEffects} from './bombEffects';
import {FxaaPostProcess} from '@babylonjs/core/PostProcesses/fxaaPostProcess';
import {GRAPHICS,knifeTiming} from './presentation';
import {CombatDebug} from './combatDebug';
import {createKnifeRig,type KnifeRig} from './knifeRig';
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import {BOMB_SITES} from './bomb';
import {cosmetic} from "./cosmetics";
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
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
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
import { raySolid, clamp, nearbyViewmodelSolids } from "./physics";
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
  private terrainMaterials=new Map<string,PBRMaterial>();
  private photographicTextures=new Map<string,Texture>();
  private lastKnifeStyle="";
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
      shield?:Mesh;
    }
  >();
  private flashes = new Map<string, number>();
  private gunRoot: TransformNode;
  private weapons = new Map<WeaponId, TransformNode>();
  private tracerPool: { mesh: Mesh; until: number }[] = [];
  private impactPool: { mesh: Mesh; until: number }[] = [];
  private visualTick=0;
  private localShield?:Mesh;
  private shieldMat?:StandardMaterial;
  private poolIndex = 0;
  private gunKick = 0;
  private inspectTime = 0;
  private lastSelectedWeapon: WeaponId = "rifle";
  private combatOverlay?:CombatDebug;
  private knifeRig?:KnifeRig;
  private knifeClock=0;
  private knifeDeployTimer = 0;
  private knifeDrawFlourishTimer = 0;
  private knifeDrawFlourishDur = 0.88;
  private knifeAttackTimer = 0;
  private knifeAttackType: "slash" | "heavy" = "slash";
  private knifeAttackCombo = 0;
  private qualityApplied = "";
  private supplyMeshes=new Map<string,TransformNode>();
  private plane?:TransformNode;
  private falling?:Mesh;
  private smoke:Mesh[]=[];
  private bombMesh?:Mesh;
  private bombIndicator?:Mesh;
  private bombBeaconRing?:Mesh;
  private blast?:BombEffects;
  private blastFlash?:Mesh;
  private heldBomb?:Mesh;
  private reloadAt = 0;
  private muzzle: Mesh;
  private shadow?: ShadowGenerator;
  private fxaa?:FxaaPostProcess;
  private observer?: ResizeObserver;
  private lastEvent = 0;
  private frameDrawCalls = 0;
  private previousDrawCalls = 0;
  private settings: StrikeSettings;
  private dynamicScale=1;
  private scaleTimer=performance.now();
  private slowSamples=0;
  private fastSamples=0;
  private readonly scratchFrom = new Vector3();
  private readonly scratchTo = new Vector3();
  private readonly scratchMid = new Vector3();
  private readonly hasMovingTargets: boolean;
  private knifeChildMeshes: Mesh[] = [];
  private appliedKnifeVisibility = "";
  private visibleWeapon?: WeaponId;
  private shadowTick = 0;
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly map: MapDefinition,
    settings: StrikeSettings,
    injectedEngine?: Engine,
  ) {
    this.settings = settings;
    this.hasMovingTargets = Array.isArray(map.targets) && map.targets.some((t) => !!t.moving);
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
      this.scene.fogStart = map.id==='district'?95:68;
      this.scene.fogEnd = map.id==='district'?220:175;
      this.scene.fogColor = Color3.FromHexString(map.sky);
      this.scene.skipPointerMovePicking = true;
      this.scene.shadowsEnabled=effectiveQuality==='high';
      this.scene.autoClear = true;
      const hemi = new HemisphericLight(
        "sky",
        new Vector3(0.2, 1, 0.3),
        this.scene,
      );
      hemi.intensity = map.id === "neon" ? 0.5 : map.id==='district'?(effectiveQuality==='high'?.85:.65):.6;
      const sun = new DirectionalLight(
        "sun",
        new Vector3(-0.4, -1, 0.3),
        this.scene,
      );
      sun.position.set(15, 35, -20);
      sun.intensity = map.id === "neon" ? 0.45 : map.id==='district'?(effectiveQuality==='high'?1.35:.65):.65;
      if (effectiveQuality === "high") {
        this.shadow = new ShadowGenerator(2048, sun);
        this.shadow.usePoissonSampling = true;this.shadow.bias=.003;this.shadow.normalBias=.06;
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
      ground.material = this.terrainMaterial(map.floor,false,map.id==='dust'?'stone':map.id==='neon'?'asphalt':'concrete');
      this.worldUV(ground);
      ground.receiveShadows = true;
      ground.isPickable = false;
      ground.freezeWorldMatrix();
      ground.doNotSyncBoundingInfo = true;
      if(map.id==='district')for(const site of BOMB_SITES){
        const ring=MeshBuilder.CreateTorus('plant-zone-'+site.id,{diameter:site.radius*2,thickness:.12,tessellation:64},this.scene);
        ring.position.set(site.x,site.y+.14,site.z);ring.material=this.material('#ffd078',true);ring.isPickable=false;
        ring.freezeWorldMatrix();ring.doNotSyncBoundingInfo=true;
      }
      const batches = new Map<string, Mesh[]>();
      for (const s of map.solids) {
        if(s.hidden)continue;

        let mesh: Mesh | ReturnType<Mesh["createInstance"]>;
        if (s.kind === "ramp") {
          const x = s.w / 2,
            z = s.d / 2,
            heights = (s.axis === "x" ? [0, s.h, s.h, 0] : [0, 0, s.h, s.h]).map(h=>s.reverse?s.h-h:h);
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
          mesh.material = this.terrainMaterial(s.color,!!s.glow,s.surface,s.label,true);
        } else {
          mesh = s.shape ? MeshBuilder.CreateCylinder(s.id,{height:s.h,diameter:s.w,diameterTop:s.shape==='cone'?0:s.w,tessellation:s.shape==='cone'?8:12},this.scene) : MeshBuilder.CreateBox(s.id,{width:s.w,height:s.h,depth:s.d},this.scene);
          if(s.shape)mesh.scaling.z=s.d/s.w;
          mesh.material = this.terrainMaterial(s.color,!!s.glow,s.surface,s.label);
        }
        if(s.surface&&!s.label&&!s.shape)this.worldUV(mesh as Mesh);
        mesh.position.set(s.x, s.y + (s.kind === "box" ? s.h / 2 : 0), s.z);
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        const material=mesh.material as StandardMaterial;
        const groupKey=material.name+"|"+(s.detail?"detail":"structure");
        const group=batches.get(groupKey) || [];group.push(mesh as Mesh);batches.set(groupKey,group);
      }
      // Small authored districts are geometry-light: one static batch per material
      // trades fine-grained culling for substantially fewer draw calls.
      for(const [key,meshes] of batches){
        const material=meshes[0].material as StandardMaterial;
        const batch=Mesh.MergeMeshes(meshes,true,true)!;
        batch.name="district-"+key;batch.metadata={detail:key.endsWith("|detail")};batch.material=material;
        batch.receiveShadows=true;batch.isPickable=false;batch.freezeWorldMatrix();batch.doNotSyncBoundingInfo=true;
        this.shadow?.addShadowCaster(batch);
      }
      // Large framed photos are separate from collision and are batched by their shared frame material.
      if(map.photoFrames?.length){
        const photoTextures=new Map<string,Texture>(),photoMaterials=new Map<string,StandardMaterial>(),frameBars:Mesh[]=[];
        const frameMaterial=this.material('#8b6847',false,'wood');
        for(const frame of map.photoFrames){
          let photoMaterial=photoMaterials.get(frame.image);
          if(!photoMaterial){
            let texture=photoTextures.get(frame.image);
            if(!texture){
              texture=new Texture(frame.image+'?v=complete-2',this.scene,false,true);
              texture.gammaSpace=true;texture.anisotropicFilteringLevel=8;
              photoTextures.set(frame.image,texture);
            }
            photoMaterial=new StandardMaterial('map-photo-'+frame.id,this.scene);
            photoMaterial.diffuseTexture=texture;photoMaterial.emissiveTexture=texture;photoMaterial.disableLighting=true;photoMaterial.diffuseColor=Color3.White();
            photoMaterial.emissiveColor=Color3.White();photoMaterial.specularColor=Color3.Black();
            photoMaterial.backFaceCulling=false;photoMaterial.freeze();photoMaterials.set(frame.image,photoMaterial);
          }
          const plane=MeshBuilder.CreatePlane(frame.id,{width:frame.width,height:frame.height,sideOrientation:Mesh.DOUBLESIDE},this.scene);
          plane.position.set(frame.x,frame.y,frame.z);plane.rotation.y=frame.rotationY;
          plane.material=photoMaterial;plane.isPickable=false;plane.receiveShadows=false;plane.freezeWorldMatrix();plane.doNotSyncBoundingInfo=true;
          const theta=frame.rotationY,t=.18,depth=.14;
          const addBar=(name:string,width:number,height:number,localX:number,localY:number)=>{
            const bar=MeshBuilder.CreateBox(name,{width,height,depth},this.scene);
            bar.position.set(frame.x+localX*Math.cos(theta),frame.y+localY,frame.z-localX*Math.sin(theta));
            bar.rotation.y=theta;bar.material=frameMaterial;bar.isPickable=false;bar.receiveShadows=false;
            frameBars.push(bar);
          };
          addBar(frame.id+'-frame-top',frame.width+2*t,t,0,frame.height/2+t/2);
          addBar(frame.id+'-frame-bottom',frame.width+2*t,t,0,-frame.height/2-t/2);
          addBar(frame.id+'-frame-left',t,frame.height,t/2+frame.width/2,0);
          addBar(frame.id+'-frame-right',t,frame.height,-t/2-frame.width/2,0);
        }
        if(frameBars.length){
          const frameBatch=Mesh.MergeMeshes(frameBars,true,true);
          if(frameBatch){frameBatch.name='map-photo-frames';frameBatch.material=frameMaterial;frameBatch.isPickable=false;frameBatch.freezeWorldMatrix();frameBatch.doNotSyncBoundingInfo=true;}
        }
      }
      const hazard = MeshBuilder.CreateCylinder(
        "hazard",
        { diameter: map.hazard.r * 2, height: 0.04, tessellation: 24 },
        this.scene,
      );
      hazard.position.set(map.hazard.x, 0.025, map.hazard.z);
      hazard.material = this.material("#dd643f", true);
      hazard.isPickable = false;
      hazard.freezeWorldMatrix();
      hazard.doNotSyncBoundingInfo = true;
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
          const stylePart = (style: string, name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string, partKind: 'blade' | 'handle' = 'blade') => {
            const m = part(name, x, y, z, w, h, d, color);
            m.metadata = { knifeStyle: style, knifePart: partKind };
            return m;
          };

          // --- DEFAULT COMBAT KNIFE ---
          stylePart('default', 'handle', 0, -0.04, -0.1, 0.075, 0.10, 0.22, '#26313c', 'handle');
          stylePart('default', 'guard', 0, 0, 0.015, 0.18, 0.03, 0.04, '#637b8c', 'handle');
          const defBlade = stylePart('default', 'blade', 0, 0.015, 0.20, 0.014, 0.065, 0.34, '#d8e3e9', 'blade');
          defBlade.rotation.z = 0.12;

          // --- TANTO KNIFE (Angular Chisel Tip, Habaki, Tsuba, Braided Tsuka) ---
          stylePart('tanto', 'habaki', 0, 0.012, 0.03, 0.022, 0.045, 0.035, '#d97706', 'handle');
          stylePart('tanto', 'tsuba', 0, 0.012, 0.005, 0.09, 0.06, 0.012, '#334155', 'handle');
          stylePart('tanto', 'tsuka', 0, 0.012, -0.12, 0.036, 0.052, 0.23, '#1e293b', 'handle');
          stylePart('tanto', 'blade-main', 0, 0.015, 0.17, 0.014, 0.058, 0.25, '#d8e3e9', 'blade');
          const tantoTip = stylePart('tanto', 'blade-chisel-point', 0, 0.008, 0.31, 0.008, 0.042, 0.07, '#e2e8f0', 'blade');
          tantoTip.rotation.x = -0.32;

          // Separate grips for the straight blades; existing ring/balisong rigs stay untouched.
          for(const style of ['default','tanto']){
            const glove=(name:string,x:number,y:number,z:number,diameter:number)=>{
              const mesh=MeshBuilder.CreateSphere(style+'-'+name,{diameter,segments:8},this.scene);
              mesh.parent=root;mesh.position.set(x,y,z);mesh.material=this.material('#1b2936');mesh.renderingGroupId=2;mesh.isPickable=false;mesh.metadata={knifeStyle:style,knifePart:'handle'};return mesh;
            };
            const palm=glove('tactical-glove',.025,-.045,-.105,.115);palm.scaling.set(.85,.78,1.3);
            const wrist=glove('tactical-wrist',.045,-.065,-.23,.11);wrist.scaling.set(.85,.85,2);
            for(let finger=0;finger<4;finger++){const grip=glove('grip-finger-'+finger,-.018,-.015,-.17+finger*.035,.044);grip.scaling.set(1.4,.85,.7);}
            const thumb=glove('grip-thumb',.046,.006,-.08,.047);thumb.scaling.set(.7,1.1,1.6);
          }

          this.knifeRig=createKnifeRig(this.scene,root,(color,metal)=>this.material(color,false,metal?'metal':undefined));
          this.knifeChildMeshes = root.getChildMeshes() as Mesh[];

          this.weapons.set(id, root);
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
        if (id === "sniper" || id === "railgun") {
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
      this.applyCosmetics();
      this.muzzle.position.set(0, 0.02, 0.75);
      this.muzzle.material = this.material("#ffdd94", true);
      this.muzzle.renderingGroupId = 2;
      this.muzzle.setEnabled(false);
      for (let i = 0; i < 48; i++) {
        const mesh = MeshBuilder.CreateBox('tracer'+i,{width:.035,height:.035,depth:1},this.scene);
        mesh.material=this.material('#ffdc78',true);
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
      if(effectiveQuality==='high'&&this.engine.getClassName()!=='NullEngine')this.fxaa=new FxaaPostProcess('high-fxaa',1,this.camera);
      this.configureShadowRefresh();
      this.qualityApplied=effectiveQuality;
      for(const mesh of this.scene.meshes)if(mesh.name.startsWith("district-"))mesh.setEnabled(effectiveQuality!=="low"||!mesh.metadata?.detail);
      if (!injectedEngine) {
        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(canvas);
      }
      this.engine.onContextLostObservable.add(() => {
        canvas.dispatchEvent(new Event("strike-context-lost"));
      });
    } catch (error) {
      this.observer?.disconnect();this.blast?.dispose();
      this.engine.dispose();
      throw error;
    }
  }
  private quality(){return this.settings.quality==='auto'?detectAutoQuality():this.settings.quality;}
  private textureSize(){return this.quality()==='high'?512:GRAPHICS[this.quality()].surface;}
  private finishMaterial(finish: import('./cosmetics').Cosmetic): StandardMaterial {
        const key='finish-'+finish.id;
        let material=this.materials.get(key);
        if(!material){
          const appearance=finishAppearance(finish);
          material=new StandardMaterial(key,this.scene);
          material.diffuseColor=Color3.FromHexString(appearance.base);
          material.specularColor=Color3.Lerp(Color3.White(),Color3.FromHexString(appearance.accent),.25);
          material.specularPower=96;
          // A small self-lit coat preserves the finish in dark maps without washing
          // the whole weapon into a flat emissive silhouette.
          material.emissiveColor=Color3.White().scale(appearance.glow);
          if(typeof document!=='undefined'&&this.engine.getClassName()!=='NullEngine'){
            const texture=new Texture(finishTextureUrl(finish),this.scene,false,false,Texture.TRILINEAR_SAMPLINGMODE);
            texture.name=key+'-shared-paint';texture.gammaSpace=true;texture.anisotropicFilteringLevel=4;
            material.diffuseTexture=texture;material.emissiveTexture=texture;
            material.diffuseColor=Color3.White();
          }
          material.freeze();this.materials.set(key,material);
        }
        return material;
  }
  private applyCosmetics(){
    this.appliedKnifeVisibility = "";
    for(const [weapon,root] of this.weapons){
      const finish=cosmetic(this.settings.cosmeticLoadout?.[weapon]);
      let material:StandardMaterial|undefined;
      if(finish) material=this.finishMaterial(finish);
      for(const mesh of root.getChildMeshes()){
        if(!mesh.metadata?.baseMaterial)mesh.metadata={...mesh.metadata,baseMaterial:mesh.material};
        if(weapon==='knife')mesh.setEnabled(mesh.metadata.knifeStyle===(finish?.knife||'default'));
        const isBlade = mesh.metadata?.knifePart === 'blade';
        const isKnifeHandle = weapon === 'knife' && !isBlade;
        const tinted = !isKnifeHandle && (weapon === 'knife' || /receiver|stock|barrel|magazine|pump/.test(mesh.name));
        mesh.material = material && tinted ? material : mesh.metadata.baseMaterial;
      }
    }
  }
  debugCombat(value:any){if(!(import.meta as any).env?.DEV||!this.settings.showDebugStats)return;(this.combatOverlay??=new CombatDebug(this.scene)).shot(value);}
  private straightKnife(style:string,phase:'draw'|'inspect'|'attack',progress:number,heavy=false,combo=0){
    const k=straightKnifeMotion(style,phase,progress,heavy,combo);this.gunRoot.position.addInPlaceFromFloats(k.x,k.y,k.z);this.gunRoot.rotation.addInPlaceFromFloats(k.rx,k.ry,k.rz);
  }
  inspect(){this.knifeDrawFlourishTimer=0;this.inspectTime=this.lastSelectedWeapon==='knife'?knifeTiming(cosmetic(this.settings.cosmeticLoadout?.knife)?.knife||'default').inspect:1.8;}
  resetView(){this.inspectTime=0;this.gunKick=0;this.camera.rotationQuaternion=null;this.camera.rotation.set(0,0,0);this.camera.upVector.set(0,1,0);this.camera.cameraRotation.set(0,0);this.camera.cameraDirection.set(0,0,0);}
  updateSettings(next:StrikeSettings){
    const previousScale = this.settings.scale;
    const previousDynamicScale = this.dynamicScale;
    const previousQuality = this.qualityApplied;
    const cosmeticsChanged = JSON.stringify(this.settings.cosmeticLoadout) !== JSON.stringify(next.cosmeticLoadout);
    this.settings=next;
    if (cosmeticsChanged) this.applyCosmetics();
    const q=next.quality==='auto'?detectAutoQuality():next.quality;
    if(q!==this.qualityApplied){
      this.qualityApplied=q;this.dynamicScale=1;this.slowSamples=0;this.fastSamples=0;
      for(const mesh of this.scene.meshes){
        if(mesh.name!=='ground'&&!mesh.name.startsWith('district-'))continue;
        const data=mesh.material?.metadata;if(data?.surface||data?.label||data?.doubleSided){const material=this.terrainMaterial(data.color,data.emissive,data.surface,data.label,data.doubleSided);mesh.material=material;}
      }
      for(const m of this.scene.meshes)if(m.name.startsWith('district-'))m.setEnabled(q!=='low'||!m.metadata?.detail);
      const sun=this.scene.getLightByName('sun') as DirectionalLight;
      sun.intensity=this.map.id==='district'?(q==='high'?1.35:.65):this.map.id==='neon'?.45:.65;
      this.scene.getLightByName('sky')!.intensity=this.map.id==='district'?(q==='high'?.85:.65):this.map.id==='neon'?.5:.6;
      if(q==='high'&&!this.shadow){this.shadow=new ShadowGenerator(2048,sun);this.shadow.usePoissonSampling=true;this.shadow.bias=.003;this.shadow.normalBias=.06;for(const m of this.scene.meshes)if(m.receiveShadows && m.name !== 'ground')this.shadow.addShadowCaster(m);this.configureShadowRefresh();}
      if(q!=='high'&&this.shadow){this.shadow.dispose();this.shadow=undefined;}
      // Retain shared PBR textures until scene disposal. Several batches reference
      // each texture, and high quality reuses them without network/GPU reuploads.
      this.scene.shadowsEnabled=q==='high';
      if(q==='high'&&!this.fxaa&&this.engine.getClassName()!=='NullEngine')this.fxaa=new FxaaPostProcess('high-fxaa',1,this.camera);
      if(q!=='high'&&this.fxaa){this.fxaa.dispose(this.camera);this.fxaa=undefined;}
      for(let i=GRAPHICS[q].tracers;i<this.tracerPool.length;i++){this.tracerPool[i].mesh.setEnabled(false);this.impactPool[i].mesh.setEnabled(false);}
    }
    if(!next.dynamicResolution)this.dynamicScale=1;
    if (previousQuality !== q || previousScale !== next.scale || previousDynamicScale !== this.dynamicScale) this.resize();
  }
  private renderSupplies(state:TrainingState){
    const world=state.world;if(!world)return;
    const ids=new Set(world.pickups.map(p=>p.id));
    for(const [id,node] of this.supplyMeshes)if(!ids.has(id)){node.dispose();this.supplyMeshes.delete(id);}
    for(const p of world.pickups){
      let node=this.supplyMeshes.get(p.id);
      if(!node){
        node=new TransformNode(p.id,this.scene);
        const box=MeshBuilder.CreateBox(p.id+'-case',{width:p.kind==='dropped'?.65:1.1,height:p.kind==='dropped'?.14:.65,depth:.7},this.scene);box.parent=node;box.position.y=.4;box.material=this.material(p.consumable==='health'?'#16a34a':p.consumable==='armor'?'#2563eb':p.kind==='airdrop'?'#dc2626':'#78716c',false,'metal');
        const lid=MeshBuilder.CreateBox(p.id+'-lid',{width:1.12,height:.09,depth:.72},this.scene);lid.parent=node;lid.position.y=.77;lid.material=this.material(p.consumable==='health'?'#4ade80':p.consumable==='armor'?'#60a5fa':p.kind==='airdrop'?'#f87171':(WEAPONS[p.weapon]?.color||'#d6d3d1'),true);lid.setEnabled(p.kind!=='dropped');
        if(p.consumable==='health'){for(const [w,h] of [[.13,.42],[.42,.13]]){const m=MeshBuilder.CreateBox(p.id+'-cross',{width:w,height:h,depth:.04},this.scene);m.parent=node;m.position.set(0,.5,-.37);m.material=this.material('#d9ffe3',true);}}
        if(p.consumable==='armor'){const m=MeshBuilder.CreateCylinder(p.id+'-shield',{diameter:.42,height:.04,tessellation:5},this.scene);m.parent=node;m.rotation.x=Math.PI/2;m.position.set(0,.5,-.37);m.material=this.material('#9ee5ff',true);}
        if(p.weapons)for(let i=0;i<p.weapons.length;i++){const m=MeshBuilder.CreateBox(p.id+'-weapon-'+i,{width:.12,height:.05,depth:.5},this.scene);m.parent=node;m.position.set(-.3+i*.3,.85,0);m.material=this.material(WEAPONS[p.weapons[i]].color);}
        this.supplyMeshes.set(p.id,node);
      }
      node.position.set(p.position.x,p.position.y,p.position.z);node.setEnabled(!p.opened);
      if(p.kind==='dropped')node.rotation.y=state.tick*C.dt;
    }
    if(!this.plane && !world.drop && !world.pickups.some(p=>p.kind==='airdrop'&&!p.opened))return;
    if(!this.plane){
      this.plane=new TransformNode('supply-aircraft',this.scene);
      for(const [name,w,h,d] of [['fuselage',1,1,8],['wings',12,.2,2],['tail',4,.25,1]] as const){const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},this.scene);m.parent=this.plane;m.position.z=name==='tail'?-3:0;m.material=this.material('#8e9da8',false,'metal');}
      this.falling=MeshBuilder.CreateBox('descending-supply',{size:1.1},this.scene);this.falling.material=this.material('#b65c63',false,'metal');
      const chute=MeshBuilder.CreateSphere('supply-parachute',{diameter:4,segments:8,slice:.5},this.scene);chute.parent=this.falling;chute.position.y=4;chute.material=this.material('#c6bba5');
      for(let i=0;i<12;i++){const puff=MeshBuilder.CreateSphere('red-supply-smoke',{diameter:1,segments:6},this.scene);const mat=new StandardMaterial('smoke-'+i,this.scene);mat.diffuseColor=Color3.FromHexString('#df314f');mat.emissiveColor=mat.diffuseColor.scale(.5);mat.alpha=.3;mat.disableLighting=true;puff.material=mat;puff.isPickable=false;this.smoke.push(puff);}
    }
    const drop=world.drop;
    this.plane.setEnabled(!!drop);this.falling!.setEnabled(!!drop);
    if(drop){const t=clamp((state.tick-drop.warning)/(drop.landing-drop.warning),0,1);this.plane.position.set(drop.position.x-85+t*170,55,drop.position.z);this.plane.rotation.y=Math.PI/2;this.falling!.position.set(drop.position.x,(1-t)*42+1,drop.position.z);}
    const smokeTarget=world.pickups.find(p=>p.kind==='airdrop'&&!p.opened);
    this.smoke.forEach((p,i)=>{p.setEnabled(!!smokeTarget&&i<GRAPHICS[this.quality()].smoke);if(smokeTarget&&i<GRAPHICS[this.quality()].smoke){const t=((state.tick*C.dt*.3+i/12)%1);p.position.set(smokeTarget.position.x+Math.sin(i*2+t*2)*t,smokeTarget.position.y+.8+t*12,smokeTarget.position.z+Math.cos(i*2+t*2)*t);p.scaling.setAll(.6+t*2);}});
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
  private terrainMaterial(color:string,emissive=false,surface?:Solid['surface'],label?:string,doubleSided=false){
    const q=this.settings.quality==='auto'?detectAutoQuality():this.settings.quality;
    if(q!=='high'||emissive||label||!surface)return this.material(color,emissive,surface,label,doubleSided);
    const key=JSON.stringify([color,surface,doubleSided]);let m=this.terrainMaterials.get(key);
    if(!m){
      m=new PBRMaterial('terrain-pbr-'+key,this.scene);m.albedoColor=Color3.FromHexString(color);m.metallic=surface==='metal'?.65:0;m.roughness=surface==='glass'?.2:surface==='metal'?.48:.92;
      const photographic=['stone','plaster','concrete','brick'].includes(surface)&&typeof document!=='undefined'&&this.engine.getClassName()!=='NullEngine';
      if(photographic){
        const set=surface==='stone'||(surface==='concrete'&&color===this.map.floor)?'stone':'wall';
        const load=(channel:string,gamma:boolean)=>{const key=set+'-'+channel;let t=this.photographicTextures.get(key);if(!t){t=new Texture(`/kapsstrike/materials/${key}.webp`,this.scene,false,false);t.gammaSpace=gamma;t.anisotropicFilteringLevel=16;this.photographicTextures.set(key,t);}return t;};
        m.albedoTexture=load('albedo',true);m.albedoColor=Color3.Lerp(Color3.White(),Color3.FromHexString(color),.15);
        m.bumpTexture=load('normal',false);m.bumpTexture.level=.58;m.invertNormalMapY=true;
        m.metallicTexture=load('roughness',false);m.useRoughnessFromMetallicTextureGreen=true;m.useRoughnessFromMetallicTextureAlpha=false;m.useMetallnessFromMetallicTextureBlue=false;m.metallic=0;m.roughness=1;
      }else{
        const resolution = surface === 'metal' || surface === 'wood' || surface === 'asphalt' ? 1024 : 512;
        const t = surfaceTexture(this.scene, 'high-surface-' + surface, '#d0d0d0', surface, undefined, resolution);
        if (t) {
          m.albedoTexture = t;
          m.albedoColor = Color3.Lerp(m.albedoColor, Color3.White(), .10);
        }
      }
      m.backFaceCulling=!doubleSided;
      m.metadata={color,surface,emissive,label,doubleSided};m.freeze();this.terrainMaterials.set(key,m);
    }
    return m;
  }
  private configureShadowRefresh(){
    const sm=this.shadow?.getShadowMap();
    if(!sm)return;
    // Static map geometry never moves; render 2048x2048 shadow map once unless moving practice dummies are active.
    sm.refreshRate=this.hasMovingTargets?RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYTWOFRAMES:RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  }
  private material(color: string, emissive = false, surface?:Solid['surface'],label?:string,doubleSided=false) {
    const key = JSON.stringify([color,emissive,surface,label,doubleSided,surface||label?this.quality():null]);
    let m = this.materials.get(key);
    if (!m) {
      m = new StandardMaterial(key, this.scene);
      m.diffuseColor = Color3.FromHexString(color);
      const texture=surfaceTexture(this.scene,key,color,surface,label,this.textureSize());
      if(texture){m.diffuseTexture=texture;m.diffuseColor=Color3.White();}
      m.specularColor = color === "#253140" ? new Color3(.22,.25,.3) : new Color3(0.035, 0.035, 0.035);
      if(surface==='water'||surface==='glass') {m.specularColor=new Color3(.45,.52,.57);m.specularPower=64;}
      if(color === "#253140")m.specularPower=64;
      if (emissive) {
        m.emissiveColor = m.diffuseColor;
        if(texture)m.emissiveTexture=texture;
        m.disableLighting = true;
      }
      m.backFaceCulling=!doubleSided;
      m.metadata={color,surface,label,emissive,doubleSided};
      m.freeze();
      this.materials.set(key, m);
    }
    return m;
  }
  private resize() {
    if(this.engine.getClassName()==='NullEngine')return;
    const profile=GRAPHICS[this.quality()],dpr=Math.min(globalThis.devicePixelRatio||1,profile.dpr),scale=this.quality()==='low'?Math.min(1,this.settings.scale):this.settings.scale;
    this.engine.setHardwareScalingLevel(1/(dpr*scale*profile.pixelScale*this.dynamicScale));
    this.engine.resize();
  }
  process(events: CombatEvent[], localActor?: string, predicted=false) {
    for (const e of events) {
      if (!predicted && e.id <= this.lastEvent) continue;
      if (!predicted) this.lastEvent = e.id;
      if (e.kind === "hit" && e.target && this.remotePlayerMeshes.has(e.target)) this.flashes.set(e.target, performance.now() + 120);
      if (e.kind === "shot" && e.from && e.to) {
        if (!localActor || e.actor === localActor) {
          this.gunKick = 0.06;
          if (e.weapon === "knife") {
            const isHeavy = !!e.head || (typeof e.damage === "number" && e.damage > 50);
            this.knifeAttackType = isHeavy ? "heavy" : "slash";
            this.knifeAttackTimer = isHeavy ? 0.48 : 0.28;
            this.knifeAttackCombo = (this.knifeAttackCombo + 1) % 2;
          }
        }
        if(e.weapon==="knife")continue;
        const item = this.tracerPool[this.poolIndex % GRAPHICS[this.quality()].tracers],
          impact = this.impactPool[this.poolIndex++ % GRAPHICS[this.quality()].tracers];
        const from=this.scratchFrom.set(e.from.x,e.from.y,e.from.z),to=this.scratchTo.set(e.to.x,e.to.y,e.to.z);
        // Offset the visual tracer only. The hit ray still starts at the aiming eye.
        const rayX = to.x - from.x, rayZ = to.z - from.z;
        const horizontal = Math.hypot(rayX, rayZ);
        if (Vector3.Distance(from, to) > 1 && horizontal > .05) {
          if (!localActor || e.actor === localActor) {
            this.muzzle.computeWorldMatrix(true);
            from.copyFrom(this.muzzle.getAbsolutePosition());
          } else {
            from.x += (rayX * .65 + rayZ * .22) / horizontal;
            from.z += (rayZ * .65 - rayX * .22) / horizontal;
            from.y -= .29;
          }
        } else {
          from.y -= .18;
        }
        const distance=Vector3.Distance(from,to);
        if(distance<.01)continue;
        this.scratchMid.copyFrom(from).addInPlace(to).scaleInPlace(.5);
        item.mesh.position.copyFrom(this.scratchMid);item.mesh.scaling.z=distance;
        item.mesh.lookAt(to);item.mesh.visibility=1;
        item.mesh.setEnabled(true);
        item.until = performance.now() + (localActor&&e.actor!==localActor?220:140);
        impact.mesh.position.set(e.to.x, e.to.y, e.to.z);
        impact.mesh.setEnabled(true);
        impact.until = performance.now() + 150;
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
    correction:Vec3={x:0,y:0,z:0},
    spectator?:{position:Vec3;yaw:number;pitch:number;stance:string},
    bombEquipped=false,
  ) {
    this.visualTick=state.tick;
    const p = state.player,
      m = p.movement;
    this.camera.position.set(
      previous.x + (m.position.x - previous.x) * alpha+correction.x,
      previous.y+(m.position.y-previous.y)*alpha + (m.stance === "stand" ? C.eye : C.crouchEye)+correction.y,
      previous.z + (m.position.z - previous.z) * alpha+correction.z,
    );
    const hurtAge = (state.tick - state.lastDamageTick) * C.dt;
    this.camera.rotationQuaternion=null;this.camera.upVector.set(0,1,0);
    this.camera.cameraRotation.set(0,0);this.camera.cameraDirection.set(0,0,0);
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
    for (const s of nearbyViewmodelSolids(this.map, this.camera.position))
      if (!s.detail&&Math.abs(s.x-this.camera.position.x)<=s.w/2+1&&Math.abs(s.z-this.camera.position.z)<=s.d/2+1&&s.y<=this.camera.position.y+1&&s.y+s.h>=this.camera.position.y-1)
        wall = Math.min(wall, raySolid(this.camera.position, dir, s, 1));
    const near = clamp(1 - wall, 0, 1);
    if (p.weapon.selected !== this.lastSelectedWeapon) {
      if (p.weapon.selected === "knife") {
        const kStyle = cosmetic(this.settings.cosmeticLoadout?.knife)?.knife || "default";
        this.knifeDeployTimer = knifeTiming(kStyle).deploy;
        this.knifeDrawFlourishDur = kStyle === "butterfly" ? 0.92 : kStyle === "karambit" ? 0.84 : knifeTiming(kStyle).deploy;
        this.knifeDrawFlourishTimer = this.knifeDrawFlourishDur;
        this.inspectTime = 0;
      }
      this.lastSelectedWeapon = p.weapon.selected;
    }

    const finish = cosmetic(this.settings.cosmeticLoadout?.[p.weapon.selected]);
    const knifeType = finish?.knife || "default", timing = knifeTiming(knifeType);
    if (p.weapon.selected === "knife" && knifeType !== this.lastKnifeStyle) {
      this.lastKnifeStyle = knifeType;
      this.knifeDeployTimer = timing.deploy;
      this.knifeDrawFlourishDur = knifeType === "butterfly" ? 0.92 : knifeType === "karambit" ? 0.84 : timing.deploy;
      this.knifeDrawFlourishTimer = this.knifeDrawFlourishDur;
      this.inspectTime = 0;
    }

    if (p.weapon.selected === "knife") {
      // Base CS tactical knife posture
      if (knifeType === "karambit") {
        // CS Karambit: Parallel to the user across the screen (~80% horizontal, ~20% upward tilt)
        this.gunRoot.position.set(0.22, -0.22, 0.78);
        this.gunRoot.rotation.set(-0.18, -1.16, 0.06);
      } else if (knifeType === "butterfly") {
        this.gunRoot.position.set(0.22, -0.23, 0.80);
        this.gunRoot.rotation.set(-0.08, -0.62, -0.14);
      } else {
        this.gunRoot.position.set(0.25, -0.25, 0.48);
        this.gunRoot.rotation.set(-0.05, 0.10, -0.10);
      }

      if (this.knifeDeployTimer > 0) {
        this.knifeDeployTimer = Math.max(0, this.knifeDeployTimer - delta);
      }
      if (this.knifeAttackTimer > 0 || this.inspectTime > 0 || p.hp <= 0) {
        this.knifeDrawFlourishTimer = 0;
        if(knifeType!=='karambit'&&knifeType!=='butterfly')this.knifeDeployTimer=0;
      }
      if (this.knifeDrawFlourishTimer > 0) {
        this.knifeDrawFlourishTimer = Math.max(0, this.knifeDrawFlourishTimer - delta);
      }

      const drawActive = this.knifeDrawFlourishTimer > 0 || this.knifeDeployTimer > 0;
      const drawProg =
        knifeType === "karambit" || knifeType === "butterfly"
          ? this.knifeDrawFlourishTimer > 0
            ? 1 - this.knifeDrawFlourishTimer / Math.max(0.01, this.knifeDrawFlourishDur)
            : this.knifeDeployTimer > 0
              ? 1 - this.knifeDeployTimer / timing.deploy
              : -1
          : this.knifeDeployTimer > 0
            ? 1 - this.knifeDeployTimer / timing.deploy
            : -1;

      // 1. Equip / Draw Wrist Choreography (CS 1-to-1)
      if (drawActive && drawProg >= 0) {
        if (knifeType === "karambit") {
          // Rise from lower-right -> upward launch flick -> steady spin hover -> palm slap recoil
          const rise = Math.pow(Math.max(0, 1 - drawProg / 0.28), 2);
          const launchFlick = Math.sin(clamp(drawProg / 0.34, 0, 1) * Math.PI);
          const catchPulse = Math.sin(clamp((drawProg - 0.70) / 0.24, 0, 1) * Math.PI);
          this.gunRoot.position.y -= rise * 0.24 - launchFlick * 0.045 + catchPulse * 0.032;
          this.gunRoot.position.x += rise * 0.08 - launchFlick * 0.035 + catchPulse * 0.022;
          this.gunRoot.position.z -= catchPulse * 0.035;
          this.gunRoot.rotation.x += rise * 0.35 - launchFlick * 0.24 + catchPulse * 0.18;
          this.gunRoot.rotation.y += launchFlick * 0.22 - catchPulse * 0.12;
          this.gunRoot.rotation.z += launchFlick * 0.32 - catchPulse * 0.20;
        } else if (knifeType === "butterfly") {
          // Rise -> upward unlatch toss -> knuckle rollover dip -> closing whip -> handle clack snap
          const rise = Math.pow(Math.max(0, 1 - drawProg / 0.24), 2);
          const toss1 = Math.sin(clamp(drawProg / 0.36, 0, 1) * Math.PI);
          const toss2 = Math.sin(clamp((drawProg - 0.38) / 0.40, 0, 1) * Math.PI);
          const clack = Math.sin(clamp((drawProg - 0.78) / 0.20, 0, 1) * Math.PI);
          this.gunRoot.position.y -= rise * 0.22 - toss1 * 0.05 + toss2 * 0.035 + clack * 0.028;
          this.gunRoot.position.x += rise * 0.07 - toss1 * 0.04 + clack * 0.018;
          this.gunRoot.rotation.x += rise * 0.28 - toss1 * 0.26 + toss2 * 0.20 + clack * 0.14;
          this.gunRoot.rotation.y += toss1 * 0.18 - toss2 * 0.16;
          this.gunRoot.rotation.z -= toss1 * 0.28 - toss2 * 0.24 + clack * 0.16;
        } else {
          this.straightKnife(knifeType,'draw',drawProg);
        }
      }

      // 2. Attack / Slash & Heavy Backstab Choreography
      let attackProg = -1;
      if (this.knifeAttackTimer > 0) {
        this.knifeAttackTimer = Math.max(0, this.knifeAttackTimer - delta);
        const dur = this.knifeAttackType === "heavy" ? 0.48 : 0.28;
        attackProg = 1 - this.knifeAttackTimer / dur;
        const strike = Math.sin(attackProg * Math.PI);

        if (this.knifeAttackType === "heavy") {
          if (knifeType === "karambit") {
            // CS Karambit Heavy Backstab / Reverse-Grip Talon Rip
            const windup = Math.sin(clamp(attackProg / 0.26, 0, 1) * Math.PI);
            const lunge = Math.sin(clamp((attackProg - 0.16) / 0.84, 0, 1) * Math.PI);
            this.gunRoot.position.z += lunge * 0.38 - windup * 0.06;
            this.gunRoot.position.y += lunge * 0.08 - windup * 0.09;
            this.gunRoot.position.x -= lunge * 0.16 - windup * 0.05;
            this.gunRoot.rotation.x -= lunge * 0.65 - windup * 0.25;
            this.gunRoot.rotation.y += lunge * 0.55;
            this.gunRoot.rotation.z += lunge * 0.68;
          } else if (knifeType === "butterfly") {
            // CS Butterfly Heavy Forward Thrust + Wrist Snap
            const lunge = Math.sin(attackProg * Math.PI);
            this.gunRoot.position.z += lunge * 0.40;
            this.gunRoot.position.y -= lunge * 0.08;
            this.gunRoot.position.x -= lunge * 0.12;
            this.gunRoot.rotation.x += lunge * 0.58;
            this.gunRoot.rotation.y += lunge * 0.32;
            this.gunRoot.rotation.z -= lunge * 0.36;
          } else {
            this.straightKnife(knifeType,'attack',attackProg,true,this.knifeAttackCombo);
          }
          this.camera.fov -= strike * 0.025;
        } else {
          const dir = this.knifeAttackCombo === 0 ? 1 : -1;
          if (knifeType === "karambit") {
            // CS Karambit Curved Claw Hook Slash
            this.gunRoot.position.x += dir * strike * 0.29;
            this.gunRoot.position.y += Math.cos(attackProg * Math.PI) * 0.085;
            this.gunRoot.position.z += strike * 0.24;
            this.gunRoot.rotation.z += dir * strike * 1.55;
            this.gunRoot.rotation.y += dir * strike * 0.68;
            this.gunRoot.rotation.x -= strike * 0.42;
          } else if (knifeType === "butterfly") {
            // CS Butterfly Fast Figure-8 Balisong Slash
            this.gunRoot.position.x += dir * strike * 0.27;
            this.gunRoot.position.y += Math.sin(attackProg * Math.PI * 2) * 0.055;
            this.gunRoot.position.z += strike * 0.22;
            this.gunRoot.rotation.z += dir * strike * 1.38;
            this.gunRoot.rotation.y += dir * strike * 0.62;
            this.gunRoot.rotation.x -= strike * 0.28;
          } else {
            this.straightKnife(knifeType,'attack',attackProg,false,this.knifeAttackCombo);
          }
          this.camera.fov -= strike * 0.012;
        }
      }

      // 3. Inspect Wrist Choreography (CS 1-to-1)
      if (this.inspectTime > 0) {
        this.inspectTime = Math.max(0, this.inspectTime - delta);
        const inspectProg = 1 - this.inspectTime / timing.inspect;
        if (knifeType === "karambit") {
          // Hand tilts slightly and pumps rhythmically with each counter-clockwise revolution,
          // then snaps into palm catch
          const env = Math.sin(inspectProg * Math.PI) ** 1.3;
          const spinPump =
            inspectProg >= 0.08 && inspectProg < 0.86
              ? Math.sin(((inspectProg - 0.08) / 0.78) * Math.PI * 6)
              : 0;
          const catchSnap = Math.sin(clamp((inspectProg - 0.86) / 0.14, 0, 1) * Math.PI);
          this.gunRoot.position.x -= env * 0.045 - catchSnap * 0.02;
          this.gunRoot.position.y += env * 0.058 + spinPump * 0.018 * env - catchSnap * 0.035;
          this.gunRoot.position.z -= env * 0.025 + catchSnap * 0.025;
          this.gunRoot.rotation.x -= env * 0.18 + spinPump * 0.10 * env + catchSnap * 0.16;
          this.gunRoot.rotation.y += env * 0.25 - catchSnap * 0.12;
          this.gunRoot.rotation.z -= Math.sin(inspectProg * Math.PI * 3) * 0.16 * env - catchSnap * 0.20;
        } else if (knifeType === "butterfly") {
          // Continuous, silky-smooth figure-8 wrist wave synchronized with the
          // 4-revolution high-speed balisong twirl and final handle clack
          const env = Math.sin(inspectProg * Math.PI);
          const spinWave = Math.sin(inspectProg * Math.PI * 8);
          const cosWave = Math.cos(inspectProg * Math.PI * 8);
          const clackSnap =
            inspectProg > 0.88
              ? Math.sin(((inspectProg - 0.88) / 0.12) * Math.PI)
              : 0;
          this.gunRoot.position.x -= env * 0.055 + cosWave * 0.014 * env;
          this.gunRoot.position.y += env * 0.062 + spinWave * 0.022 * env - clackSnap * 0.026;
          this.gunRoot.position.z -= env * 0.025;
          this.gunRoot.rotation.x -= spinWave * 0.18 * env + clackSnap * 0.14;
          this.gunRoot.rotation.y += env * 0.30 + cosWave * 0.14 * env;
          this.gunRoot.rotation.z += spinWave * 0.26 * env - clackSnap * 0.15;
        } else {
          this.straightKnife(knifeType,'inspect',inspectProg);
        }
      }

      this.knifeClock += delta;
      if (this.knifeAttackTimer > 0 || p.hp <= 0) this.inspectTime = 0;
      this.knifeRig?.update(
        knifeType,
        drawActive ? drawProg : -1,
        this.inspectTime > 0 ? 1 - this.inspectTime / timing.inspect : -1,
        this.knifeClock,
        delta,
        attackProg,
        this.knifeAttackType === "heavy",
        this.knifeAttackCombo,
      );
      const speed = Math.min(1, Math.hypot(p.movement.velocity.x, p.movement.velocity.z) / 6.7);
      this.gunRoot.position.y += Math.sin(this.knifeClock * 8) * 0.009 * speed + Math.sin(this.knifeClock * 1.8) * 0.003;
      this.gunRoot.rotation.z += Math.sin(this.knifeClock * 4) * 0.018 * speed;
    } else {
      // Firearm viewmodel animations
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
      if (this.inspectTime > 0) {
        if (ads || this.gunKick > 0 || p.weapon.reloadUntil || p.hp <= 0) this.inspectTime = 0;
        else {
          this.inspectTime = Math.max(0, this.inspectTime - delta);
          const t = (1.8 - this.inspectTime) / 1.8, pose = Math.sin(Math.PI * t);
          this.gunRoot.rotation.z += pose * 1.15;
          this.gunRoot.rotation.y += pose * 0.75;
          this.gunRoot.position.x -= pose * 0.15;
          this.gunRoot.position.y += pose * 0.1;
          const index = WEAPON_ORDER.indexOf(p.weapon.selected);
          this.gunRoot.rotation.x += pose * (0.15 + index * 0.04);
          this.gunRoot.position.z += Math.sin(t * Math.PI * 2) * (0.02 + index * 0.005);
        }
      }
    }
    this.gunRoot.setEnabled(!(ads && (p.weapon.selected === "sniper" || p.weapon.selected === "railgun")));
    this.gunRoot.scaling.setAll(ads ? 0.85 : 1);
    if (this.visibleWeapon !== p.weapon.selected) {
      for (const [id, mesh] of this.weapons) mesh.setEnabled(id === p.weapon.selected);
      this.visibleWeapon = p.weapon.selected;
    }
    if (p.weapon.selected === "knife" && this.appliedKnifeVisibility !== knifeType) {
      this.appliedKnifeVisibility = knifeType;
      for (const child of this.knifeChildMeshes) {
        child.setEnabled(child.metadata?.knifeStyle === knifeType);
      }
    }
    if (this.shadow) {
      const sm = this.shadow.getShadowMap();
      if (sm) {
        const hasLiveMoving = this.hasMovingTargets && state.targets.length > 0;
        const desiredRate = hasLiveMoving
          ? RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYTWOFRAMES
          : RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
        if (sm.refreshRate !== desiredRate) sm.refreshRate = desiredRate;
      }
    }
    for (const [id, target] of this.targetMeshes) {
      if (!state.targets.some((t) => t.id === id)) target.root.setEnabled(false);
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
    const nowPerf = performance.now();
    for (const a of this.tracerPool){
      if(a.until<nowPerf)a.mesh.setEnabled(false);
      else a.mesh.visibility=Math.min(1,(a.until-nowPerf)/100);
    }
    for (const a of this.impactPool)
      if (a.until < nowPerf) a.mesh.setEnabled(false);
    if(!this.localShield)this.localShield=this.spawnShield('local');
    this.localShield.position.set(m.position.x,m.position.y+(m.stance==='stand'?.9:.6),m.position.z);
    this.localShield.scaling.y=m.stance==='stand'?1:.75;
    this.localShield.setEnabled(p.hp>0&&p.protectedUntil>state.tick&&!spectator);
    if(!state.bomb)this.renderSupplies(state);
    const isPlanting=!!(state.bomb?.action?.kind==='plant'&&state.bomb.action.player===p.id);
    const showHeldBomb=(bombEquipped||isPlanting)&&p.hp>0;
    if(state.bomb){
      const b=state.bomb;
      if(!this.bombMesh){
        this.bombMesh=MeshBuilder.CreateBox('tactical-bomb',{width:.52,height:.18,depth:.38},this.scene);
        this.bombMesh.material=this.material('#5c664e',false,'metal');
        this.bombMesh.isPickable=false;
        for(const side of [-0.14,0.14]){
          const strap=MeshBuilder.CreateBox('bomb-strap',{width:.05,height:.195,depth:.40},this.scene);
          strap.parent=this.bombMesh;strap.position.x=side;strap.material=this.material('#232924',false,'metal');strap.isPickable=false;
        }
        const keypad=MeshBuilder.CreateBox('bomb-keypad',{width:.18,height:.03,depth:.20},this.scene);
        keypad.parent=this.bombMesh;keypad.position.set(-.08,.10,0);keypad.material=this.material('#2a312b',false,'metal');keypad.isPickable=false;
        const screen=MeshBuilder.CreateBox('bomb-lcd',{width:.16,height:.032,depth:.09},this.scene);
        screen.parent=this.bombMesh;screen.position.set(.11,.10,-.05);screen.material=this.material('#73c69b',true);screen.isPickable=false;
        const wire=MeshBuilder.CreateBox('bomb-wire',{width:.22,height:.025,depth:.03},this.scene);
        wire.parent=this.bombMesh;wire.position.set(.02,.10,.08);wire.material=this.material('#d9463e',true);wire.isPickable=false;
        const light=MeshBuilder.CreateSphere('bomb-indicator',{diameter:.095,segments:10},this.scene);
        light.parent=this.bombMesh;light.position.set(.12,.12,.06);
        const lmat=this.material('#ff2a2a',true).clone('bomb-indicator-mat')!;
        lmat.disableLighting=true;light.material=lmat;light.isPickable=false;
        this.bombIndicator=light;
        const ring=MeshBuilder.CreateTorus('bomb-beacon-ring',{diameter:.9,thickness:.035,tessellation:32},this.scene);
        ring.parent=this.bombMesh;ring.position.y=-.06;ring.isPickable=false;
        const rmat=this.material('#ff3838',true).clone('bomb-beacon-mat')!;
        rmat.disableLighting=true;rmat.alpha=.55;ring.material=rmat;
        this.bombBeaconRing=ring;
      }
      const visible=!!b.position&&(b.phase==='active'||b.phase==='planted');
      this.bombMesh.setEnabled(visible);
      if(visible&&b.position){
        this.bombMesh.position.set(b.position.x,b.position.y+.15,b.position.z);
        const indicator=this.bombIndicator;
        const beaconRing=this.bombBeaconRing;
        if(b.phase==='planted'){
          const left=Math.max(0,b.deadline-state.tick*C.dt);
          const freq=left>20?1.3:left>10?2.4:left>5?4.8:left>2?9.5:18;
          const phase=Math.sin(performance.now()*0.001*freq*Math.PI*2);
          const pulse=phase>0?1:0.15;
          if(indicator){
            indicator.scaling.setAll(0.85+pulse*0.65);
            const mat=indicator.material as StandardMaterial;
            mat.emissiveColor=pulse>0.5?new Color3(1,.22,.18):new Color3(.35,.04,.04);
          }
          if(beaconRing){
            beaconRing.setEnabled(true);
            const cycle=(performance.now()*0.001*freq)%1;
            beaconRing.scaling.set(0.6+cycle*2.2,1,0.6+cycle*2.2);
            (beaconRing.material as StandardMaterial).alpha=Math.max(0,(1-cycle)*0.65);
          }
        }else{
          indicator?.scaling.setAll(0.8);
          beaconRing?.setEnabled(false);
        }
      }
    }else this.bombMesh?.setEnabled(false);
    if(showHeldBomb&&!this.heldBomb){
      this.heldBomb=MeshBuilder.CreateBox('held-bomb',{width:.36,height:.20,depth:.25},this.scene);
      this.heldBomb.parent=this.camera;this.heldBomb.position.set(.18,-.25,.55);this.heldBomb.material=this.material('#596253',false,'metal');this.heldBomb.isPickable=false;
      const screen=MeshBuilder.CreateBox('held-bomb-display',{width:.16,height:.028,depth:.10},this.scene);
      screen.parent=this.heldBomb;screen.position.set(.06,.11,-.03);screen.material=this.material('#73c69b',true);screen.isPickable=false;
      const pad=MeshBuilder.CreateBox('held-bomb-keypad',{width:.13,height:.025,depth:.14},this.scene);
      pad.parent=this.heldBomb;pad.position.set(-.08,.11,.01);pad.material=this.material('#232b24',false,'metal');pad.isPickable=false;
      const led=MeshBuilder.CreateSphere('held-bomb-led',{diameter:.055,segments:8},this.scene);
      led.parent=this.heldBomb;led.position.set(.11,.12,.06);led.material=this.material('#ff3b3b',true);led.isPickable=false;
    }
    this.heldBomb?.setEnabled(showHeldBomb);
    if(showHeldBomb&&this.heldBomb){
      this.gunRoot.setEnabled(false);
      if(isPlanting&&state.bomb?.action){
        const pProg=clamp((state.tick*C.dt-state.bomb.action.started)/3.2,0,1);
        const tap=Math.sin(pProg*Math.PI*16)*0.018;
        this.heldBomb.position.set(0.03+Math.sin(pProg*Math.PI*8)*0.01,-0.16+tap,0.44);
        this.heldBomb.rotation.set(-0.45+tap*2.2,-0.12,Math.sin(pProg*Math.PI*8)*0.06);
      }else{
        const bob=Math.sin(state.tick*0.08)*0.008;
        this.heldBomb.position.set(.18,-.25+bob,.55);
        this.heldBomb.rotation.set(-0.18,-0.22,0);
      }
    }
    if(state.bomb&&p.hp<=0){
      this.gunRoot.setEnabled(false);
      if(spectator&&!(state.bomb.explosion&&(this.blast?this.blast.age<2.6:state.tick*C.dt-state.bomb.explosion.at<2.6))){this.camera.position.set(spectator.position.x,spectator.position.y+(spectator.stance==='stand'?C.eye:C.crouchEye),spectator.position.z);this.camera.rotation.set(spectator.pitch,spectator.yaw,0);}
    }
    if(state.bomb){
      if(!this.blastFlash){this.blastFlash=MeshBuilder.CreatePlane('bomb-camera-flash',{size:2},this.scene);this.blastFlash.parent=this.camera;this.blastFlash.position.z=.1;this.blastFlash.isPickable=false;this.blastFlash.renderingGroupId=3;const mat=this.material('#ffcb78',true).clone('bomb-flash-material')!;mat.disableLighting=true;mat.backFaceCulling=false;mat.disableDepthWrite=true;this.blastFlash.material=mat;}
      this.blast??=new BombEffects(this.scene);
      const shake=this.blast.update(state.bomb.explosion,delta,this.camera.position,this.quality()==='low');
      const explosion=state.bomb.explosion,age=explosion?this.blast.age:10;
      const distance=explosion?Math.hypot(p.movement.position.x-explosion.position.x,p.movement.position.y-explosion.position.y,p.movement.position.z-explosion.position.z):100;
      const flash=Math.max(0,1-distance/42)*Math.max(0,1-Math.max(0,age)/.72)*.85;
      this.blastFlash.setEnabled(flash>0&&age>=0&&age<.72);(this.blastFlash.material as StandardMaterial).alpha=flash;
      this.camera.rotation.x+=shake.x;this.camera.rotation.y+=shake.y;this.camera.rotation.z+=shake.z;
    }
    this.scene.render();
    if(this.observer && this.settings.dynamicResolution && performance.now()-this.scaleTimer>1500){
      this.scaleTimer=performance.now();const fps=this.engine.getFps();
      this.slowSamples=fps<45 ? this.slowSamples+1:0;
      this.fastSamples=fps>58 ? this.fastSamples+1:0;
      const before=this.dynamicScale;
      if(this.slowSamples>=2){this.dynamicScale=Math.max(this.quality()==='low'?.55:this.quality()==='high'?.85:.65,this.dynamicScale-.1);this.slowSamples=0;}
      else if(this.fastSamples>=4){this.dynamicScale=Math.min(1,this.dynamicScale+.05);this.fastSamples=0;}
      if(before!==this.dynamicScale)this.resize();
    }
    const draws = this.engine._drawCalls.current;
    this.frameDrawCalls = Math.max(0, draws - this.previousDrawCalls);
    this.previousDrawCalls = draws;
  }
  private spawnShield(id:string){
    if(!this.shieldMat){const mat=new StandardMaterial('spawn-shield-gold',this.scene);mat.diffuseColor=Color3.FromHexString('#ffe155');mat.emissiveColor=Color3.FromHexString('#d4a620');mat.alpha=.17;mat.backFaceCulling=false;mat.disableDepthWrite=true;this.shieldMat=mat;}
    const shield=MeshBuilder.CreateSphere('spawn-shield-'+id,{diameter:2.4,segments:12},this.scene);shield.material=this.shieldMat;shield.isPickable=false;shield.setEnabled(false);return shield;
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
      weaponSkin?:string;
      protectedUntil?:number;
    }>,
    localPlayerId?: string,
    localTeam?: string,
    hiddenPlayerId?: string
  ) {
    if((import.meta as any).env?.DEV&&this.settings.showDebugStats)(this.combatOverlay??=new CombatDebug(this.scene)).poses(players.filter(p=>p.id!==localPlayerId&&p.hp>0).map(p=>({...p,height:p.stance==='stand'?C.standing:C.crouching})));
    const activeIds = new Set<string>();
    const now = performance.now();

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

        const shield=this.spawnShield(p.id);shield.parent=root;shield.position.y=.9;
        item = { shield,model, skin:cleanSkin(p.skin), team:p.team || "none", root, body, head, tagPlane, gun, tagTex, tagMat };
        this.remotePlayerMeshes.set(p.id, item);
      }

      item.model.flash((this.flashes.get(p.id) || 0) > now);
      const isAlive = p.hp > 0;
      item.shield?.setEnabled(isAlive&&(p.protectedUntil||0)>this.visualTick);
      if(item.shield){item.shield.scaling.y=p.stance==='crouch'?.75:1;item.shield.position.y=p.stance==='crouch'?.6:.9;}
      item.root.setEnabled(isAlive && p.id !== hiddenPlayerId);
      if (isAlive) {
        item.root.position.set(p.position.x, p.position.y, p.position.z);
        item.root.rotation.y = p.yaw;
        item.head.rotation.x = p.pitch;
        if (item.gun) {
          item.gun.scaling.set(p.selectedWeapon === "knife" ? 0.5 : 1, p.selectedWeapon === "knife" ? 0.22 : 1, 1);
          const finish=cosmetic(p.weaponSkin);
          item.gun.material = finish ? this.finishMaterial(finish) : this.material(p.selectedWeapon === "knife" ? "#d8e3e9" : "#1e293b");
        }

        const isCrouch = p.stance === "crouch" || p.stance === "slide";
        const offset = isCrouch ? C.standing - C.crouching : 0;
        item.model.gearRoot.scaling.y = isCrouch ? C.crouching / C.standing : 1;
        const low = Math.max(0.08, TARGET_HITBOXES.body.min - offset);
        const high = TARGET_HITBOXES.body.max - offset;
        item.body.scaling.y = (high - low) / (TARGET_HITBOXES.body.max - TARGET_HITBOXES.body.min);
        item.body.position.y = (low + high) / 2;
        item.model.neck.position.y=(TARGET_HITBOXES.body.max+TARGET_HITBOXES.head.min)/2-offset;
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
    this.observer?.disconnect();this.blast?.dispose();
    this.fxaa?.dispose(this.camera);this.combatOverlay?.dispose();
    this.shadow?.dispose();
    this.scene.dispose();
    this.engine.dispose();
    this.photographicTextures.clear();this.supplyMeshes.clear();this.smoke=[];this.plane=undefined;this.falling=undefined;
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
