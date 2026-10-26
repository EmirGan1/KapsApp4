// Categorical colors chosen for separation; do not recycle colors within a match.
export const TERRITORY_COLORS=['#e6194b','#00e000','#0000e0','#20c0e0','#e0c060','#c080e0','#008040','#c08080','#e000e0','#002080','#e06000','#c0e000'];
function lab(hex:string){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v>.04045?((v+.055)/1.055)**2.4:v/12.92);const [r,g,b]=rgb;const xyz=[(r*.4124+g*.3576+b*.1805)/.95047,(r*.2126+g*.7152+b*.0722),(r*.0193+g*.1192+b*.9505)/1.08883].map(v=>v>.008856?Math.cbrt(v):7.787*v+16/116);return [116*xyz[1]-16,500*(xyz[0]-xyz[1]),200*(xyz[1]-xyz[2])]}
export function colorDistance(a:string,b:string){const x=lab(a),y=lab(b);return Math.hypot(...x.map((v,i)=>v-y[i]))}
export function chooseTerritoryColor(used:string[]){return [...TERRITORY_COLORS].filter(c=>!used.includes(c)).sort((a,b)=>Math.min(...used.map(c=>colorDistance(b,c)),1e6)-Math.min(...used.map(c=>colorDistance(a,c)),1e6))[0] || TERRITORY_COLORS[0]}
