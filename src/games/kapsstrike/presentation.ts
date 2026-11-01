export const GRAPHICS={low:{surface:0,shadow:0,dpr:1,pixelScale:.8,tracers:12,smoke:2},medium:{surface:256,shadow:0,dpr:1.5,pixelScale:1,tracers:32,smoke:6},high:{surface:1024,shadow:2048,dpr:2,pixelScale:1,tracers:48,smoke:12}} as const;
/** 2.4 → .65 sec inspect; .65 → .18 sec deploy: approximately 3.6–3.7× faster. */
export function knifeTiming(style:string){return style==='karambit'||style==='butterfly'?{inspect:.65,deploy:.18}:{inspect:.95,deploy:.28};}
