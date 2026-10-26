import geography from '../data/kapstorialGeography.json';
export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 640;
export const TOTAL_PIXELS = MAP_WIDTH * MAP_HEIGHT;
export type MapType = 'world' | 'europe' | 'anatolia' | 'archipelago' | 'arena';
export interface MapMetadata { id: MapType; name: string; description: string; landPercentage: number; previewThumbnailColor: string; }
export const MAP_PRESETS: Record<MapType, MapMetadata> = {
 world:{id:'world',name:'Dünya',description:'Gerçek kıta ve kıyı şekilleri; kıtalar arası deniz seferleri.',landPercentage:30,previewThumbnailColor:'#1e3a8a'},
 europe:{id:'europe',name:'Avrupa',description:'Britanya, İberya, İskandinavya ve Akdeniz kıyıları.',landPercentage:45,previewThumbnailColor:'#065f46'},
 anatolia:{id:'anatolia',name:'Türkiye',description:'Trakya ve Anadolu; gerçek ülke sınırı ve üç deniz.',landPercentage:45,previewThumbnailColor:'#991b1b'},
 archipelago:{id:'archipelago',name:'Adalar',description:'Eşit büyüklükte 12 ada; dengeli deniz savaşları.',landPercentage:40,previewThumbnailColor:'#0e7490'},
 arena:{id:'arena',name:'Arena',description:'Dört eksende simetrik dağ geçitleri ve geniş topraklar.',landPercentage:65,previewThumbnailColor:'#854d0e'}
};
type Polygon = number[][][];
const cache = new Map<string, Uint8Array>();
/** Scanline rasterization of Natural Earth public domain polygon rings, including holes. */
function rasterize(polygons: Polygon[], bounds: number[], grid: Uint8Array) {
 const [west,south,east,north]=bounds; const cos=Math.cos((south+north)/2*Math.PI/180);
 const scale=Math.min((MAP_WIDTH-32)/((east-west)*cos),(MAP_HEIGHT-32)/(north-south));
 const left=(MAP_WIDTH-(east-west)*cos*scale)/2,top=(MAP_HEIGHT-(north-south)*scale)/2;
 for(const polygon of polygons){
  const rings=polygon.map(ring=>ring.map(([lon,lat])=>[left+(lon-west)*cos*scale,top+(north-lat)*scale]));
  const ys=rings[0].map(p=>p[1]);const start=Math.max(0,Math.ceil(top),Math.floor(Math.min(...ys))),end=Math.min(MAP_HEIGHT-1,Math.floor(top+(north-south)*scale)-1,Math.ceil(Math.max(...ys)));
  for(let y=start;y<=end;y++){
   const intersections:number[]=[];const scan=y+.5;
   for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i];if((a[1]>scan)!==(b[1]>scan))intersections.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }
   intersections.sort((a,b)=>a-b);
   for(let i=0;i+1<intersections.length;i+=2){const x0=Math.max(0,Math.ceil(left),Math.ceil(intersections[i]-.5)),x1=Math.min(MAP_WIDTH-1,Math.floor(left+(east-west)*cos*scale)-1,Math.floor(intersections[i+1]-.5));if(x1>=x0)grid.fill(1,y*MAP_WIDTH+x0,y*MAP_WIDTH+x1+1)}
  }
 }
}
export function generateTerrainMap(type: MapType, seed=1): Uint8Array {
 const key=type==='arena'||type==='archipelago'?`${type}:${seed}`:type;
 const old=cache.get(key);if(old)return old.slice();
 const grid=new Uint8Array(TOTAL_PIXELS);
 if(type==='world')rasterize(geography.land,[-180,-60,180,85],grid);
 else if(type==='europe')rasterize(geography.land,[-15,32,45,72],grid);
 else if(type==='anatolia')rasterize(geography.turkey,[25,35,45,43],grid);
 else if(type==='arena'){
  const cx=(MAP_WIDTH-1)/2,cy=(MAP_HEIGHT-1)/2,r=MAP_HEIGHT*.46;
  for(let y=0;y<MAP_HEIGHT;y++)for(let x=0;x<MAP_WIDTH;x++){
   const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);
   if(d<r)grid[y*MAP_WIDTH+x]=Math.abs(d-r*.63)<7&&Math.min(Math.abs(dx),Math.abs(dy))>18?2:1;
  }
 }else{
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
   const cx=(col+.5)*MAP_WIDTH/4,cy=(row+.5)*MAP_HEIGHT/3,r=MAP_HEIGHT/3*.37;
   for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++){
    const angle=Math.atan2(y-cy,x-cx),radius=r*(.95+.05*Math.cos(angle*5));
    if(Math.hypot(x-cx,y-cy)<radius)grid[y*MAP_WIDTH+x]=1;
   }
  }
 }
 if(cache.size>=16)cache.delete(cache.keys().next().value!);cache.set(key,grid.slice());return grid;
}
/** Exclude isolated fragments that cannot support an equal 37-cell starting army. */
export function getValidSpawnPixels(terrain: Uint8Array): number[] {
 const seen = new Uint8Array(terrain.length), result: number[] = [];
 for (let start = 0; start < terrain.length; start++) {
  if (seen[start] || terrain[start] !== 1) continue;
  const queue = [start]; seen[start] = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
   const idx = queue[cursor], x = idx % MAP_WIDTH, y = Math.floor(idx / MAP_WIDTH);
   const adjacent = [x > 0 ? idx - 1 : -1, x < MAP_WIDTH - 1 ? idx + 1 : -1, y > 0 ? idx - MAP_WIDTH : -1, y < MAP_HEIGHT - 1 ? idx + MAP_WIDTH : -1];
   for (const n of adjacent) if (n >= 0 && !seen[n] && terrain[n] === 1) { seen[n] = 1; queue.push(n); }
  }
  if (queue.length >= 37) for (const idx of queue) result.push(idx);
 }
 return result;
}
