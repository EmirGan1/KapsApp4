/** Cosmetic IDs only. No gameplay numbers are stored here. */
export const SKINS = {
  classic:{name:"Classic Soldier",body:"#657b64",trim:"#374839",gear:"helmet"},
  urban:{name:"Urban Runner",body:"#678ba3",trim:"#ecad61",gear:"hood"},
  neon:{name:"Neon Striker",body:"#526483",trim:"#60d9cc",gear:"antenna"},
  shadow:{name:"Shadow Operative",body:"#4a5263",trim:"#bf9ba8",gear:"visor"},
  desert:{name:"Desert Scout",body:"#bc9b70",trim:"#73604c",gear:"hat"},
  arctic:{name:"Arctic Fighter",body:"#d4e1e6",trim:"#6389a6",gear:"parka"},
  cyber:{name:"Cyber Agent",body:"#796ba4",trim:"#bbd9e3",gear:"fins"},
  street:{name:"Street Warrior",body:"#b57b68",trim:"#c4c7a3",gear:"cap"}
} as const;
export type SkinId=keyof typeof SKINS;
export function isSkin(value:unknown):value is SkinId{return typeof value === "string" && Object.hasOwn(SKINS,value);}
const legacySkins:Record<string,SkinId>={classic_soldier:'classic',urban_runner:'urban',neon_striker:'neon',shadow_operative:'shadow',desert_scout:'desert',arctic_fighter:'arctic',cyber_agent:'cyber',street_warrior:'street'};
export function cleanSkin(value:unknown):SkinId{return isSkin(value)?value:typeof value==='string'&&Object.hasOwn(legacySkins,value)?legacySkins[value]:"classic";}
