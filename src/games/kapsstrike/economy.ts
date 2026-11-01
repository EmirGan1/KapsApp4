/** Account credits buy cosmetics only; bomb round money is a separate economy. */
export const CREDIT_REWARDS={kill:20,round:100} as const;
export const CASE_PRICES:Record<string,number>={frontline:200,velocity:250,horizon:300,breach:250,sidearm:200,arsenal:400};
export const MAX_CREDITS=10_000_000;
export function caseCost(id:string,freeCases?:Record<string,boolean>){if(!Object.hasOwn(CASE_PRICES,id))throw new Error('Geçersiz kasa.');return freeCases?.[id]?CASE_PRICES[id]:0;}
