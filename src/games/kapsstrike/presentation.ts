export const GRAPHICS={low:{surface:0,shadow:0,dpr:1,pixelScale:.8,tracers:12,smoke:2},medium:{surface:256,shadow:0,dpr:1.5,pixelScale:1,tracers:32,smoke:6},high:{surface:1024,shadow:2048,dpr:2,pixelScale:1,tracers:48,smoke:12}} as const;
/** Draw speed reduced 25%; inspect keeps brisk rotations across three complete flourishes. */
export function knifeTiming(style:string){return style==='karambit'||style==='butterfly'?{inspect:2.6,deploy:.24}:{inspect:.95,deploy:.28};}
