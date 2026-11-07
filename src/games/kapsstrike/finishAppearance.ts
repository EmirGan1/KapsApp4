import type { Cosmetic } from './cosmetics';

/** One deterministic paint atlas for inventory art and the first-person model. */
export function finishAppearance(item: Cosmetic) {
 const eclipse=item.id.endsWith('-neon-3');
 return {base:eclipse?'#a45a09':item.color,accent:item.accent,glow:item.rarity==='uncommon'?.20:item.rarity==='rare'?.25:item.rarity==='epic'?.32:.38,eclipse};
}
const cache=new Map<string,string>();
export function finishTextureUrl(item: Cosmetic): string {
 const cached=cache.get(item.id);if(cached)return cached;
 const {base,accent,eclipse}=finishAppearance(item);
 let detail='';
 if(eclipse){
  detail=`<path d="M0 70L256 20M0 155L256 105M0 240L256 190" stroke="${accent}" stroke-width="3" opacity=".6"/>`;
 }else if(item.pattern===0){
  for(let i=0;i<20;i++) detail+=`<ellipse cx="${(i*71)%256}" cy="${(i*113)%256}" rx="${14+i%4*7}" ry="${8+i%3*8}" fill="${accent}" opacity=".55" transform="rotate(${i*31} ${(i*71)%256} ${(i*113)%256})"/>`;
 }else if(item.pattern===1){
  for(let i=0;i<16;i++){const x=(i*61)%256,y=(i*89)%256;detail+=`<path d="M${x} ${y}l40 -18l-12 55l-30 -12Z" fill="${i%2?accent:'#ffffff'}" opacity=".25"/>`;}
 }else if(item.pattern===2){
  for(let i=0;i<4;i++){let d=`M${i*64+12} 0`;for(let y=16;y<=256;y+=16)d+=`L${i*64+12+Math.sin(y*.11+i)*18} ${y}`;detail+=`<path d="${d}" fill="none" stroke="${accent}" stroke-width="9" opacity=".14"/><path d="${d}" fill="none" stroke="${accent}" stroke-width="2.5"/>`;}
 }else if(item.pattern===4){
  for(let i=0;i<10;i++)detail+=`<path d="M${i*29-40} 0l28 75l-9 45l55 136h-23l-65-127l13-52l-22-77Z" fill="${accent}" opacity=".85"/>`;
 }else if(item.pattern===5){
  for(let y=-24;y<280;y+=36)for(let x=-24;x<280;x+=42){const dx=x+(Math.floor(y/36)%2?21:0);detail+=`<path d="M${dx} ${y}l18 10v20l-18 10l-18-10v-20Z" fill="none" stroke="${accent}" stroke-width="2.2"/>`;}
 }else if(item.pattern===6){
  for(let i=0;i<30;i++){const x=(i*73)%256,y=(i*47)%256;detail+=`<path d="M${x} ${y}l${18+i%5*7} -14l-9 47Z" fill="${accent}" opacity="${.25+i%3*.2}"/>`;}
 }else if(item.pattern===7){
  for(let i=0;i<13;i++)detail+=`<ellipse cx="108" cy="134" rx="${18+i*13}" ry="${9+i*9}" fill="none" stroke="${accent}" stroke-width="2" transform="rotate(-28 108 134)" opacity=".75"/>`;
 }else if(item.pattern>=8 && item.pattern<=19){
  const variant=item.variant??0, phase=variant*13;
  for(let i=0;i<12;i++){
   const x=(i*43+phase)%256,y=(i*67+phase*2)%256;
   const motifs=[
    `<path d="M${x} 0l80 256m-64-256l80 256"/>`,
    `<path d="M0 ${y}h${x}v18h${256-x}"/>`,
    `<path d="M0 ${y}h70l12-20l18 40l12-20h144"/>`,
    `<path d="M${x} ${y}h32v32h-24v-24h16v16"/>`,
    `<path d="M0 ${y}q64-36 128 0t128 0"/>`,
    `<ellipse cx="128" cy="128" rx="${20+i*9}" ry="${10+i*5}" transform="rotate(${phase+35} 128 128)"/>`,
    `<path d="M${x} ${y}q-25-30 0-20q25-10 0 20q30-5 20 15q-20 15-20-15q-25 20-20 0Z"/>`,
    `<path d="M0 ${y}l40-12l32 20l50-30l50 30l40-15l44 7"/>`,
    `<path d="M${x} ${y}l-24-18l8 26l16 12l16-12l8-26Z"/>`,
    `<path d="M${x} ${y}c-40-40-40 40 0 0s40 40 0 0"/>`,
    `<path d="M${x} ${y}q16 32 32 0q-16 10-32 0Z"/>`,
    `<path d="M${x} ${y}l-18-24l14 8l4-20l4 20l14-8l-18 24Z"/>`
   ];
   detail+=`<g fill="none" stroke="${accent}" stroke-width="${i%3===0?3:1.4}" opacity="${.35+i%3*.25}">${motifs[item.pattern-8]}</g>`;
  }
  // A different signature/orientation for each firearm and blade, shared by inventory and game.
  detail=`<g transform="rotate(${variant*17} 128 128)">${detail}</g><path d="M${16+variant*7} 232h38" stroke="${accent}" stroke-width="5"/>`;
 }else{
  detail=`<ellipse cx="140" cy="110" rx="100" ry="60" fill="${accent}" opacity=".24"/>`;
  for(let i=0;i<38;i++)detail+=`<circle cx="${(i*83+17)%256}" cy="${(i*127+29)%256}" r="${i%7===0?2:1}" fill="#ffffff" opacity=".8"/>`;
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="coat" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".3" stop-color="${accent}"/><stop offset=".46" stop-color="${base}"/><stop offset=".64" stop-color="${accent}"/><stop offset="1" stop-color="${base}"/></linearGradient><linearGradient id="sheen" x2="0" y2="1"><stop stop-color="white" stop-opacity=".5"/><stop offset=".2" stop-color="white" stop-opacity="0"/><stop offset=".65" stop-color="white" stop-opacity="0"/><stop offset=".72" stop-color="white" stop-opacity=".24"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><path fill="url(#coat)" d="M0 0h256v256H0z"/>${detail}<path fill="url(#sheen)" d="M0 0h256v256H0z"/></svg>`;
 const url='data:image/svg+xml;base64,'+btoa(svg);cache.set(item.id,url);return url;
}
