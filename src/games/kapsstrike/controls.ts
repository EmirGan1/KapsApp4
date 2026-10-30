/** Physical codes are stored separately from translated UI labels. */
export const ACTIONS = {
  inspect:"Silahı incele", interact:"Sandık / silah al", forward:"İleri", backward:"Geri", left:"Sola", right:"Sağa", jump:"Zıpla", sprint:"Koş", crouch:"Çömel", slide:"Kay", fire:"Ateş", ads:"ADS / ağır bıçak", reload:"Şarjör", rifle:"Tüfek", smg:"SMG", sniper:"Sniper", shotgun:"Shotgun", pistol:"Tabanca", knife:"Bıçak", next:"Sonraki silah", previous:"Önceki silah", last:"Son silah", scoreboard:"Skor tablosu", menu:"Menü", ptt:"Bas-konuş"
} as const;
export type Action = keyof typeof ACTIONS;
export type Bindings = Record<Action,string>;
export const DEFAULT_BINDINGS: Bindings = {
  inspect:"KeyF", interact:"KeyE", forward:"KeyW",backward:"KeyS",left:"KeyA",right:"KeyD",jump:"Space",sprint:"ShiftLeft",crouch:"KeyC",slide:"ControlLeft",fire:"Mouse0",ads:"Mouse2",reload:"KeyR",rifle:"Digit1",smg:"Digit2",sniper:"Digit3",shotgun:"Digit4",pistol:"Digit5",knife:"Digit6",next:"WheelDown",previous:"WheelUp",last:"KeyQ",scoreboard:"Tab",menu:"Escape",ptt:"KeyV"
};
const code = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2])|Arrow(Up|Down|Left|Right)|Space|Tab|Enter|Escape|Backspace|CapsLock|(Shift|Control|Alt)(Left|Right)|Mouse[0-4]|Wheel(Up|Down)|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|Minus|Equal|Backquote)$/;
export function validBinding(value: unknown): value is string {
  if (value === "Unbound") return true;
  if (typeof value !== "string" || value.length > 70) return false;
  const parts=value.split("+");
  const key=parts.pop()!;
  return code.test(key) && parts.every((p,i)=>["Ctrl","Alt","Shift","Meta"].includes(p)&&parts.indexOf(p)===i);
}
export function cleanBindings(value: unknown,legacy?:unknown): Bindings {
  const result={...DEFAULT_BINDINGS};
  if(!value&&legacy&&typeof legacy==='object'){
    const previous={forward:'KeyW',backward:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',crouch:'ControlLeft',sprint:'ShiftLeft',reload:'KeyR',primary:'Digit1',secondary:'Digit2',knife:'Digit3',scoreboard:'Tab'};
    for(const [old,defaultKey] of Object.entries(previous)){
      const action=(old==='primary'?'rifle':old==='secondary'?'pistol':old) as Action;
      const key=(legacy as Record<string,unknown>)[old];
      if(!validBinding(key)||key===defaultKey)continue;
      for(const other of Object.keys(result) as Action[])if(other!==action&&result[other]===key)result[other]='Unbound';
      result[action]=key;
    }
  }
  if (value && typeof value === "object") for (const action of Object.keys(result) as Action[]) {
    const candidate=(value as any)[action];
    if(validBinding(candidate)) {
      if(action!=="inspect"&&candidate===result.inspect)result.inspect="Unbound";
      if(action!=="interact"&&candidate===result.interact)result.interact="Unbound";
      result[action]=candidate;
    }
  }
  return result;
}
export function bindingFromEvent(event: KeyboardEvent | MouseEvent | WheelEvent): string {
  const key = "code" in event ? event.code : "deltaY" in event ? (event.deltaY<0?"WheelUp":"WheelDown") : `Mouse${event.button}`;
  return [event.ctrlKey && !key.startsWith("Control")?"Ctrl":null,event.altKey && !key.startsWith("Alt")?"Alt":null,event.shiftKey && !key.startsWith("Shift")?"Shift":null,event.metaKey?"Meta":null,key].filter(Boolean).join("+");
}
export function held(binding: string, keys: ReadonlySet<string>): boolean {
  const parts=binding.split("+");const key=parts.pop()!;
  return keys.has(key) && parts.every(p=>p==="Ctrl"?(keys.has("ControlLeft")||keys.has("ControlRight")):p==="Shift"?(keys.has("ShiftLeft")||keys.has("ShiftRight")):p==="Alt"?(keys.has("AltLeft")||keys.has("AltRight")):(keys.has("MetaLeft")||keys.has("MetaRight")));
}
export function conflicts(bindings: Bindings, action: Action, value: string): Action[] {
  return (Object.keys(bindings) as Action[]).filter(a=>a!==action&&bindings[a].split("+").at(-1)===value.split("+").at(-1));
}
export function label(binding: string): string {
  return binding.replace("Unbound","Atanmadı").replace(/Key([A-Z])/g,"$1").replace(/Digit([0-9])/g,"$1").replace("Mouse0","Sol tık").replace("Mouse1","Orta tık").replace("Mouse2","Sağ tık").replace("WheelUp","Tekerlek ↑").replace("WheelDown","Tekerlek ↓");
}
