import type {WeaponId} from './types';
export type Rarity='uncommon'|'rare'|'epic'|'legendary'|'knife';
export const RARITIES:Record<Rarity,{name:string;color:string}>={uncommon:{name:'Sıra dışı',color:'#4ade80'},rare:{name:'Nadir',color:'#60a5fa'},epic:{name:'Destansı',color:'#c084fc'},legendary:{name:'Efsanevi',color:'#fb7185'},knife:{name:'Özel bıçak',color:'#fbbf24'}};
export interface Cosmetic {id:string;name:string;weapon:WeaponId;rarity:Rarity;color:string;accent:string;pattern:number;knife?:'butterfly'|'karambit'|'tanto'}
const guns:WeaponId[]=['rifle','smg','sniper','shotgun','pistol','carbine','lmg','railgun'];
const finishes=[{name:'Orman Kamuflajı',rarity:'uncommon',color:'#316850',accent:'#a3cf7b'},{name:'Buzul Akımı',rarity:'rare',color:'#225d9c',accent:'#8ee9ff'},{name:'Mor Yıldırım',rarity:'epic',color:'#592e92',accent:'#f0abfc'},{name:'Kızıl Süpernova',rarity:'legendary',color:'#a52542',accent:'#ffcb76'}] as const;
export const COSMETICS:Cosmetic[]=guns.flatMap(weapon=>finishes.map((f,i)=>({...f,id:weapon+'-'+i,weapon,pattern:i})));
COSMETICS.push({id:'knife-butterfly',name:'Kelebek · Aurora',weapon:'knife',rarity:'knife',color:'#6c40bf',accent:'#83faff',pattern:3,knife:'butterfly'},{id:'knife-karambit',name:'Karambit · Kor',weapon:'knife',rarity:'knife',color:'#d24c2c',accent:'#ffe07c',pattern:3,knife:'karambit'},{id:'knife-tanto',name:'Tanto · Hayalet',weapon:'knife',rarity:'knife',color:'#c2d9e9',accent:'#7cffe1',pattern:2,knife:'tanto'});
export const CASES=[{id:'frontline',name:'Cephe Kasası',color:'#4ade80',weapon:'rifle'},{id:'velocity',name:'Hız Kasası',color:'#60a5fa',weapon:'smg'},{id:'horizon',name:'Ufuk Kasası',color:'#c084fc',weapon:'sniper'},{id:'breach',name:'Kuşatma Kasası',color:'#fb7185',weapon:'shotgun'},{id:'sidearm',name:'Düello Kasası',color:'#fbbf24',weapon:'pistol'},{id:'arsenal',name:'Arsenal Kasası',color:'#67e8f9',weapon:null}] as const;
export function cosmetic(id:unknown){return typeof id==='string'?COSMETICS.find(c=>c.id===id):undefined;}
export function caseRewards(id:string):{item:Cosmetic;chance:number}[]{
 const box=CASES.find(c=>c.id===id);if(!box)return [];
 const pool=COSMETICS.filter(c=>c.weapon==='knife'||!box.weapon||c.weapon===box.weapon);
 const weights:Record<Rarity,number>={uncommon:40,rare:30,epic:20,legendary:5,knife:5};
 return pool.map(item=>({item,chance:weights[item.rarity]/pool.filter(c=>c.rarity===item.rarity).length}));
}
/** Roll is supplied by cryptographic server RNG, never by the client. */
export function rollCase(id:string,roll:number){const pool=caseRewards(id);if(!pool.length||!Number.isFinite(roll)||roll<0||roll>=1)throw new Error('Geçersiz kasa.');let n=roll*100;for(const r of pool){n-=r.chance;if(n<0)return r.item;}return pool[pool.length-1].item;}
export interface Inventory {owned:Record<string,number>;equipped:Partial<Record<WeaponId,string>>;opened:number;lastOpenedAt?:number}
export function emptyInventory():Inventory{return {owned:{},equipped:{},opened:0};}
export function cleanLoadout(value:unknown):Inventory['equipped']{const out:Inventory['equipped']={};if(value&&typeof value==='object')for(const [weapon,id] of Object.entries(value)){const c=cosmetic(id);if(c&&c.weapon===weapon)out[c.weapon]=c.id;}return out;}
