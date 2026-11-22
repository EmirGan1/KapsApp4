/** Versioned room snapshots. A read started before a write must never refill stale data. */
export class MessageRamCache {
  private cache = new Map<string, any[]>();
  private revisions = new Map<string, number>();
  private epoch = 0;
  version(key: string) { return `${this.epoch}:${this.revisions.get(key) || 0}`; }
  get(key: string) { const value=this.cache.get(key); return value ? [...value] : null; }
  set(key: string, messages: any[]) { this.cache.set(key,messages.slice(-50)); }
  push(key: string, message: any) { const list=this.cache.get(key);this.invalidate(key);if(list)this.cache.set(key,[...list,message].slice(-50)); }
  invalidate(key: string) { this.revisions.set(key,(this.revisions.get(key)||0)+1); }
  clear(key?: string) { if(key){this.cache.delete(key);this.invalidate(key);}else{this.cache.clear();this.revisions.clear();this.epoch++;} }
  delete(key:string,id:string|number) { this.clear(key); }
}
