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
    }
  >();
  private flashes = new Map<string, number>();
  private gunRoot: TransformNode;
  private weapons = new Map<WeaponId, TransformNode>();
  private tracerPool: { mesh: Mesh; until: number }[] = [];
  private impactPool: { mesh: Mesh; until: number }[] = [];
  private poolIndex = 0;
  private gunKick = 0;
  private inspectTime = 0;
  private lastSelectedWeapon: WeaponId = "rifle";
  private combatOverlay?:CombatDebug;
  private knifeRig?:KnifeRig;
  private knifeClock=0;
  private knifeDeployTimer = 0;
  private knifeAttackTimer = 0;
  private knifeAttackType: "slash" | "heavy" = "slash";
  private knifeAttackCombo = 0;
  private qualityApplied = "";
  private supplyMeshes=new Map<string,TransformNode>();
  private plane?:TransformNode;
  private falling?:Mesh;
  private smoke:Mesh[]=[];
  private bombMesh?:Mesh;
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
      ground.material = this.terrainMaterial(map.floor,false,map.id==='dust'?'plaster':'concrete');
      this.worldUV(ground);
      ground.receiveShadows = true;
      if(map.id==='district')for(const site of BOMB_SITES){
        const ring=MeshBuilder.CreateTorus('plant-zone-'+site.id,{diameter:site.radius*2,thickness:.12,tessellation:64},this.scene);
        ring.position.set(site.x,site.y+.14,site.z);ring.material=this.material('#ffd078',true);ring.isPickable=false;
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
          mesh.material = this.terrainMaterial(s.color,!!s.glow,s.surface,s.label);
          (mesh.material as StandardMaterial).backFaceCulling=false;
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

          this.knifeRig=createKnifeRig(this.scene,root,(color,metal)=>this.material(color,false,metal?'metal':undefined));

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
      if(effectiveQuality==='high'&&this.engine.getClassName()!=='NullEngine')this.fxaa=new FxaaPostProcess('high-fxaa',1,this.camera);
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
      this.observer?.disconnect();
      this.engine.dispose();
      throw error;
    }
  }
  private quality(){return this.settings.quality==='auto'?detectAutoQuality():this.settings.quality;}
  private textureSize(color?:string){return this.quality()==='high'?(color===this.map.floor?2048:1024):GRAPHICS[this.quality()].surface;}
  private applyCosmetics(){
    for(const [weapon,root] of this.weapons){
      const finish=cosmetic(this.settings.cosmeticLoadout?.[weapon]);
      let material:StandardMaterial|undefined;
      if(finish){
        const key='finish-'+finish.id;
        material=this.materials.get(key);
        if(!material){
          material=new StandardMaterial(key,this.scene);material.diffuseColor=Color3.FromHexString(finish.color);material.specularColor=Color3.FromHexString(finish.accent).scale(.6);material.specularPower=64;
          material.emissiveColor=Color3.FromHexString(finish.accent).scale(finish.rarity==='knife'?.3:finish.rarity==='legendary'?.24:finish.rarity==='epic'?.12:.015);
          if(typeof document!=='undefined'&&this.engine.getClassName()!=='NullEngine'){
            const t=new DynamicTexture(key,{width:256,height:256},this.scene,true);
            const c=t.getContext() as unknown as CanvasRenderingContext2D;
            c.fillStyle=finish.color;c.fillRect(0,0,256,256);
            if(finish.pattern===0){
              // Tactical woodland / disruptive camouflage blobs
              c.fillStyle=finish.accent;
              for(let i=0;i<18;i++){
                const bx=((i*71)%240)+8,by=((i*113)%240)+8,br=16+((i*37)%28);
                c.beginPath();c.arc(bx,by,br,0,Math.PI*2);c.fill();
                c.beginPath();c.arc(bx+br*0.6,by+br*0.3,br*0.7,0,Math.PI*2);c.fill();
              }
              c.fillStyle='rgba(15,25,20,0.35)';
              for(let i=0;i<12;i++){
                const bx=((i*97+40)%240)+8,by=((i*67+30)%240)+8;
                c.beginPath();c.ellipse(bx,by,22,12,i*0.4,0,Math.PI*2);c.fill();
              }
            }else if(finish.pattern===1){
              // Glacial geometric crystal shards & frost gradients
              for(let i=0;i<16;i++){
                const gx=((i*61)%220)+10,gy=((i*89)%220)+10;
                c.fillStyle=i%2===0?finish.accent:'rgba(255,255,255,0.22)';
                c.beginPath();c.moveTo(gx,gy);c.lineTo(gx+35,gy-12);c.lineTo(gx+25,gy+40);c.lineTo(gx-10,gy+28);c.closePath();c.fill();
              }
            }else if(finish.pattern===2){
              // Branching electric lightning discharge
              c.strokeStyle=finish.accent;c.lineWidth=3;c.shadowColor=finish.accent;c.shadowBlur=8;
              for(let bolt=0;bolt<4;bolt++){
                let lx=bolt*64+16,ly=0;
                c.beginPath();c.moveTo(lx,ly);
                while(ly<256){
                  lx+=(Math.sin(ly*0.1+bolt)*18);
                  ly+=18+((bolt*7)%12);
                  c.lineTo(lx,ly);
                }
                c.stroke();
              }
              c.shadowBlur=0;
            }else{
              // Celestial cosmic supernova nebula swirl
              const g=c.createRadialGradient(128,128,10,128,128,140);
              g.addColorStop(0,finish.accent);
              g.addColorStop(0.5,finish.color);
              g.addColorStop(1,'rgba(10,5,15,0.9)');
              c.fillStyle=g;c.fillRect(0,0,256,256);
              c.fillStyle='#ffffff';
              for(let i=0;i<45;i++){
                const sx=((i*83+17)%250)+3,sy=((i*127+29)%250)+3,sr=i%5===0?2.2:1.1;
                c.beginPath();c.arc(sx,sy,sr,0,Math.PI*2);c.fill();
              }
            }
            t.update();material.diffuseTexture=t;material.diffuseColor=Color3.White();
          }
          material.freeze();this.materials.set(key,material);
        }
      }
      for(const mesh of root.getChildMeshes()){
        if(!mesh.metadata?.baseMaterial)mesh.metadata={...mesh.metadata,baseMaterial:mesh.material};
        if(weapon==='knife')mesh.setEnabled(mesh.metadata.knifeStyle===(finish?.knife||'default'));
        const isBlade = mesh.metadata?.knifePart === 'blade';
        const isKnifeHandle = weapon === 'knife' && !isBlade;
        const tinted = !isKnifeHandle && (weapon === 'knife' || /receiver|stock/.test(mesh.name));
        mesh.material = material && tinted ? material : mesh.metadata.baseMaterial;
      }
    }
  }
  debugCombat(value:any){if(!(import.meta as any).env?.DEV||!this.settings.showDebugStats)return;(this.combatOverlay??=new CombatDebug(this.scene)).shot(value);}
  inspect(){this.inspectTime=this.lastSelectedWeapon==='knife'?knifeTiming(cosmetic(this.settings.cosmeticLoadout?.knife)?.knife||'default').inspect:1.8;}
  resetView(){this.inspectTime=0;this.gunKick=0;this.camera.rotationQuaternion=null;this.camera.rotation.set(0,0,0);this.camera.upVector.set(0,1,0);this.camera.cameraRotation.set(0,0);this.camera.cameraDirection.set(0,0,0);}
  updateSettings(next:StrikeSettings){
    this.settings=next;
    this.applyCosmetics();
    const q=next.quality==='auto'?detectAutoQuality():next.quality;
    if(q!==this.qualityApplied){
      this.qualityApplied=q;this.dynamicScale=1;this.slowSamples=0;this.fastSamples=0;
      for(const mesh of this.scene.meshes){
        if(mesh.name!=='ground'&&!mesh.name.startsWith('district-'))continue;
        const data=mesh.material?.metadata;if(data?.surface)mesh.material=this.terrainMaterial(data.color,data.emissive,data.surface,data.label);
      }
      for(const m of this.materials.values())if(m.metadata){
        const {color,surface,label,emissive}=m.metadata;
        m.unfreeze();m.diffuseTexture?.dispose();const tex=surfaceTexture(this.scene,m.name,color,surface,label,this.textureSize(color));m.diffuseTexture=tex||null;m.diffuseColor=tex?Color3.White():Color3.FromHexString(color);if(emissive)m.emissiveTexture=tex||null;m.freeze();
      }
      for(const m of this.scene.meshes)if(m.name.startsWith('district-'))m.setEnabled(q!=='low'||!m.metadata?.detail);
      const sun=this.scene.getLightByName('sun') as DirectionalLight;
      sun.intensity=this.map.id==='district'?(q==='high'?1.35:.65):this.map.id==='neon'?.45:.65;
      this.scene.getLightByName('sky')!.intensity=this.map.id==='district'?(q==='high'?.85:.65):this.map.id==='neon'?.5:.6;
      if(q==='high'&&!this.shadow){this.shadow=new ShadowGenerator(2048,sun);this.shadow.usePoissonSampling=true;this.shadow.bias=.003;this.shadow.normalBias=.06;for(const m of this.scene.meshes)if(m.name.startsWith('district-'))this.shadow.addShadowCaster(m);}
      if(q!=='high'&&this.shadow){this.shadow.dispose();this.shadow=undefined;}
      if(q!=='high'){for(const m of this.terrainMaterials.values())m.dispose(false,true);this.terrainMaterials.clear();this.photographicTextures.clear();}
      this.scene.shadowsEnabled=q==='high';
      if(q==='high'&&!this.fxaa&&this.engine.getClassName()!=='NullEngine')this.fxaa=new FxaaPostProcess('high-fxaa',1,this.camera);
      if(q!=='high'&&this.fxaa){this.fxaa.dispose(this.camera);this.fxaa=undefined;}
      for(let i=GRAPHICS[q].tracers;i<this.tracerPool.length;i++){this.tracerPool[i].mesh.setEnabled(false);this.impactPool[i].mesh.setEnabled(false);}
    }
    if(!next.dynamicResolution)this.dynamicScale=1;
    this.resize();
  }
  private renderSupplies(state:TrainingState){
    const world=state.world;if(!world)return;
    const ids=new Set(world.pickups.map(p=>p.id));
    for(const [id,node] of this.supplyMeshes)if(!ids.has(id)){node.dispose();this.supplyMeshes.delete(id);}
    for(const p of world.pickups){
      let node=this.supplyMeshes.get(p.id);
      if(!node){
        node=new TransformNode(p.id,this.scene);
        const box=MeshBuilder.CreateBox(p.id+'-case',{width:p.kind==='dropped'?.65:1.1,height:p.kind==='dropped'?.14:.65,depth:.7},this.scene);box.parent=node;box.position.y=.4;box.material=this.material(p.consumable==='health'?'#32835b':p.consumable==='armor'?'#2868a1':p.kind==='airdrop'?'#a64d55':'#556d63',false,'metal');
        const lid=MeshBuilder.CreateBox(p.id+'-lid',{width:1.12,height:.09,depth:.72},this.scene);lid.parent=node;lid.position.y=.77;lid.material=this.material(p.consumable==='health'?'#9fffbc':p.consumable==='armor'?'#72d5ff':WEAPONS[p.weapon].color,true);lid.setEnabled(p.kind!=='dropped');
        if(p.consumable==='health'){for(const [w,h] of [[.13,.42],[.42,.13]]){const m=MeshBuilder.CreateBox(p.id+'-cross',{width:w,height:h,depth:.04},this.scene);m.parent=node;m.position.set(0,.5,-.37);m.material=this.material('#d9ffe3',true);}}
        if(p.consumable==='armor'){const m=MeshBuilder.CreateCylinder(p.id+'-shield',{diameter:.42,height:.04,tessellation:5},this.scene);m.parent=node;m.rotation.x=Math.PI/2;m.position.set(0,.5,-.37);m.material=this.material('#9ee5ff',true);}
        if(p.weapons)for(let i=0;i<p.weapons.length;i++){const m=MeshBuilder.CreateBox(p.id+'-weapon-'+i,{width:.12,height:.05,depth:.5},this.scene);m.parent=node;m.position.set(-.3+i*.3,.85,0);m.material=this.material(WEAPONS[p.weapons[i]].color);}
        this.supplyMeshes.set(p.id,node);
      }
      node.position.set(p.position.x,p.position.y,p.position.z);node.setEnabled(!p.opened);
      if(p.kind==='dropped')node.rotation.y=state.tick*C.dt;
    }
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
  private terrainMaterial(color:string,emissive=false,surface?:Solid['surface'],label?:string){
    const q=this.settings.quality==='auto'?detectAutoQuality():this.settings.quality;
    if(q!=='high'||emissive||label||!surface)return this.material(color,emissive,surface,label);
    const key=color+surface;let m=this.terrainMaterials.get(key);
    if(!m){
      m=new PBRMaterial('terrain-pbr-'+key,this.scene);m.albedoColor=Color3.FromHexString(color);m.metallic=surface==='metal'?.65:0;m.roughness=surface==='glass'?.2:surface==='metal'?.48:.92;
      const photographic=['stone','plaster','concrete','brick'].includes(surface)&&typeof document!=='undefined'&&this.engine.getClassName()!=='NullEngine';
      if(photographic){
        const set=color===this.map.floor||surface==='stone'?'stone':'wall';
        const load=(channel:string,gamma:boolean)=>{const key=set+'-'+channel;let t=this.photographicTextures.get(key);if(!t){t=new Texture(`/kapsstrike/materials/${key}.webp`,this.scene,false,false);t.gammaSpace=gamma;t.anisotropicFilteringLevel=16;this.photographicTextures.set(key,t);}return t;};
        m.albedoTexture=load('albedo',true);m.albedoColor=Color3.Lerp(Color3.White(),Color3.FromHexString(color),.15);
        m.bumpTexture=load('normal',false);m.bumpTexture.level=.4;m.invertNormalMapY=true;
        m.metallicTexture=load('roughness',false);m.useRoughnessFromMetallicTextureGreen=true;m.useRoughnessFromMetallicTextureAlpha=false;m.useMetallnessFromMetallicTextureBlue=false;m.metallic=0;m.roughness=1;
      }else{
        const t=surfaceTexture(this.scene,key+'-pbr',color,surface,undefined,color===this.map.floor?2048:1024);
        if(t){m.albedoTexture=t;m.albedoColor=Color3.White();}
      }
      m.metadata={color,surface,emissive,label};this.terrainMaterials.set(key,m);
    }
    return m;
  }
  private material(color: string, emissive = false, surface?:Solid['surface'],label?:string) {
    const key = color + emissive + (surface||'') + (label||'');
    let m = this.materials.get(key);
    if (!m) {
      m = new StandardMaterial(key, this.scene);
      m.diffuseColor = Color3.FromHexString(color);
      const texture=surfaceTexture(this.scene,key,color,surface,label,this.textureSize(color));
      if(texture){m.diffuseTexture=texture;m.diffuseColor=Color3.White();}
      m.specularColor = color === "#253140" ? new Color3(.22,.25,.3) : new Color3(0.035, 0.035, 0.035);
      if(surface==='water'||surface==='glass') {m.specularColor=new Color3(.45,.52,.57);m.specularPower=64;}
      if(color === "#253140")m.specularPower=64;
      if (emissive) {
        m.emissiveColor = m.diffuseColor;
        if(texture)m.emissiveTexture=texture;
        m.disableLighting = true;
      }
      m.metadata={color,surface,label,emissive};
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
    correction:Vec3={x:0,y:0,z:0},
    spectator?:{position:Vec3;yaw:number;pitch:number;stance:string},
    bombEquipped=false,
  ) {
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
    for (const s of collisionSolids(this.map))
      if (!s.detail&&Math.abs(s.x-this.camera.position.x)<=s.w/2+1&&Math.abs(s.z-this.camera.position.z)<=s.d/2+1&&s.y<=this.camera.position.y+1&&s.y+s.h>=this.camera.position.y-1)
        wall = Math.min(wall, raySolid(this.camera.position, dir, s, 1));
    const near = clamp(1 - wall, 0, 1);
    if (p.weapon.selected !== this.lastSelectedWeapon) {
      if (p.weapon.selected === "knife") {
        this.knifeDeployTimer = knifeTiming(cosmetic(this.settings.cosmeticLoadout?.knife)?.knife||'default').deploy;
        this.inspectTime = 0;
      }
      this.lastSelectedWeapon = p.weapon.selected;
    }

    const finish = cosmetic(this.settings.cosmeticLoadout?.[p.weapon.selected]);
    const knifeType = finish?.knife || "default",timing=knifeTiming(knifeType);
    if(p.weapon.selected==='knife'&&knifeType!==this.lastKnifeStyle){this.lastKnifeStyle=knifeType;this.knifeDeployTimer=timing.deploy;this.inspectTime=0;}

    if (p.weapon.selected === "knife") {
      // Base tactical knife posture
      if (knifeType === "karambit") {
        this.gunRoot.position.set(0.22, -0.24, .85);
        this.gunRoot.rotation.set(-0.15, -0.65, -0.45);
      } else if (knifeType === "butterfly") {
        this.gunRoot.position.set(0.22, -0.24, .8);
        this.gunRoot.rotation.set(-0.08, -0.65, -0.15);
      } else {
        this.gunRoot.position.set(0.25, -0.25, 0.48);
        this.gunRoot.rotation.set(-0.05, 0.10, -0.10);
      }

      // 1. Equip / Deploy animation
      if (this.knifeDeployTimer > 0) {
        this.knifeDeployTimer = Math.max(0, this.knifeDeployTimer - delta);
        const deployProg = 1 - this.knifeDeployTimer / timing.deploy;
        if (knifeType === "karambit") {
          this.gunRoot.position.y -= (1-deployProg)*.22;
          this.gunRoot.rotation.z += Math.sin(deployProg*Math.PI)*.35;
        } else if (knifeType === "butterfly") {
          this.gunRoot.position.y -= (1-deployProg)*.20;
          this.gunRoot.rotation.z -= Math.sin(deployProg*Math.PI)*.35;
        } else {
          this.gunRoot.position.y -= (1 - deployProg) * 0.26;
          this.gunRoot.rotation.z -= (1-deployProg)*(knifeType==='tanto'?.8:1.5);
          this.gunRoot.rotation.y += (1-deployProg)*(knifeType==='tanto'?1.1:.6);
        }
      }

      // 2. Attack / Slash animation
      if (this.knifeAttackTimer > 0) {
        this.knifeAttackTimer = Math.max(0, this.knifeAttackTimer - delta);
        const dur = this.knifeAttackType === "heavy" ? 0.48 : 0.28;
        const attackProg = 1 - this.knifeAttackTimer / dur;
        const strike = Math.sin(attackProg * Math.PI);

        if (this.knifeAttackType === "heavy") {
          this.gunRoot.position.z += strike * 0.36;
          this.gunRoot.position.y -= strike * 0.16;
          this.gunRoot.position.x -= strike * 0.10;
          this.gunRoot.rotation.x += strike * 0.75;
          this.gunRoot.rotation.z -= strike * 0.45;
          this.camera.fov -= strike * 0.025;
        } else {
          const dir = this.knifeAttackCombo === 0 ? 1 : -1;
          this.gunRoot.position.x += dir * strike * 0.26;
          this.gunRoot.position.y += Math.cos(attackProg * Math.PI) * 0.09;
          this.gunRoot.position.z += strike * 0.20;
          this.gunRoot.rotation.z += dir * strike * 1.45;
          this.gunRoot.rotation.y += dir * strike * 0.55;
          this.gunRoot.rotation.x -= strike * 0.35;
          this.camera.fov -= strike * 0.012;
        }
      }

      // 3. Inspect animation
      if (this.inspectTime > 0) {
        this.inspectTime = Math.max(0, this.inspectTime - delta);
        const inspectProg = 1 - this.inspectTime / timing.inspect;
        if (knifeType === "karambit") {
          const wave=Math.sin(inspectProg*Math.PI)**2;
          this.gunRoot.position.y+=wave*.08;
          this.gunRoot.rotation.y+=wave*.35;
          this.gunRoot.rotation.z+=Math.sin(inspectProg*Math.PI*2)*.16;
        } else if (knifeType === "butterfly") {
          const wave=Math.sin(inspectProg*Math.PI)**2;
          this.gunRoot.position.y+=wave*.06;
          this.gunRoot.rotation.z+=Math.sin(inspectProg*Math.PI*2)*.3;
          this.gunRoot.rotation.y+=wave*.25;
        } else {
          const wave=Math.sin(inspectProg*Math.PI)**2;
          this.gunRoot.position.y+=wave*.10;this.gunRoot.position.x-=wave*.08;
          if(knifeType==='tanto'){this.gunRoot.rotation.y+=wave*1.1;this.gunRoot.rotation.z+=wave*.8;this.gunRoot.rotation.x+=Math.sin(inspectProg*Math.PI*2)*.3;}
          else {const t=inspectProg*inspectProg*(3-2*inspectProg);this.gunRoot.rotation.z+=t*Math.PI*2;this.gunRoot.rotation.y+=wave*.35;}
        }
      }

      this.knifeClock+=delta;
      if(this.knifeAttackTimer>0||p.hp<=0)this.inspectTime=0;
      this.knifeRig?.update(knifeType,this.knifeDeployTimer>0?1-this.knifeDeployTimer/timing.deploy:-1,this.inspectTime>0?1-this.inspectTime/timing.inspect:-1,this.knifeClock,delta);
      const speed=Math.min(1,Math.hypot(p.movement.velocity.x,p.movement.velocity.z)/6.7);
      this.gunRoot.position.y+=Math.sin(this.knifeClock*8)*.009*speed+Math.sin(this.knifeClock*1.8)*.003;
      this.gunRoot.rotation.z+=Math.sin(this.knifeClock*4)*.018*speed;
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
    for (const [id, mesh] of this.weapons) {
      const isSelected = id === p.weapon.selected;
      mesh.setEnabled(isSelected);
      if (id === "knife" && isSelected) {
        for (const child of mesh.getChildMeshes()) {
          child.setEnabled(child.metadata?.knifeStyle === knifeType);
        }
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
    for (const a of this.tracerPool)
      if (a.until < state.tick) a.mesh.setEnabled(false);
    for (const a of this.impactPool)
      if (a.until < state.tick) a.mesh.setEnabled(false);
    if(!state.bomb)this.renderSupplies(state);
    if(state.bomb){const b=state.bomb;if(!this.bombMesh){this.bombMesh=MeshBuilder.CreateBox('tactical-bomb',{width:.5,height:.22,depth:.36},this.scene);this.bombMesh.material=this.material('#626c54',false,'metal');const light=MeshBuilder.CreateBox('bomb-indicator',{width:.09,height:.025,depth:.08},this.scene);light.parent=this.bombMesh;light.position.y=.12;light.material=this.material('#ff4d4d',true);}
      this.bombMesh.setEnabled(!!b.position&&(b.phase==='active'||b.phase==='planted'));if(b.position)this.bombMesh.position.set(b.position.x,b.position.y+.15,b.position.z);
    }else this.bombMesh?.setEnabled(false);
    if(bombEquipped&&!this.heldBomb){
      this.heldBomb=MeshBuilder.CreateBox('held-bomb',{width:.36,height:.22,depth:.25},this.scene);
      this.heldBomb.parent=this.camera;this.heldBomb.position.set(.18,-.25,.55);this.heldBomb.material=this.material('#596253',false,'metal');
      const screen=MeshBuilder.CreateBox('held-bomb-display',{width:.16,height:.025,depth:.10},this.scene);screen.parent=this.heldBomb;screen.position.y=.12;screen.material=this.material('#73c69b',true);
    }
    this.heldBomb?.setEnabled(bombEquipped&&p.hp>0);
    if(bombEquipped)this.gunRoot.setEnabled(false);
    if(state.bomb&&p.hp<=0){
      this.gunRoot.setEnabled(false);
      if(spectator){this.camera.position.set(spectator.position.x,spectator.position.y+(spectator.stance==='stand'?C.eye:C.crouchEye),spectator.position.z);this.camera.rotation.set(spectator.pitch,spectator.yaw,0);}
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
    }>,
    localPlayerId?: string,
    localTeam?: string
  ) {
    if((import.meta as any).env?.DEV&&this.settings.showDebugStats)(this.combatOverlay??=new CombatDebug(this.scene)).poses(players.filter(p=>p.id!==localPlayerId&&p.hp>0).map(p=>({...p,height:p.stance==='stand'?C.standing:C.crouching})));
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
          const finish=cosmetic(p.weaponSkin);
          item.gun.material = this.material(finish?.color||(p.selectedWeapon === "knife" ? "#d8e3e9" : "#1e293b"),finish?.rarity==='knife'||finish?.rarity==='legendary');
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
    this.observer?.disconnect();
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
