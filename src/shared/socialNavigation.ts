export function positiveId(value: unknown): number | null {
  const id = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
export const postPath = (id: number) => `/gonderi/${id}`;
export function postIdFromPath(path: string) { return /^\/gonderi\/\d+\/?$/.test(path) ? positiveId(path.split('/')[2]) : null; }
export function notificationPostPath(notification: { type?: string; target_id?: unknown }) {
  const id = positiveId(notification.target_id);
  return id && ['like', 'comment'].includes(notification.type || '') ? postPath(id) : null;
}
export function profilePath(id: number) { return `/profil/${id}`; }
export function profileNamePath(username: string) { return `/profil?username=${encodeURIComponent(username)}`; }

export function mentionRanges(text: string, users: Array<{id:number;username:string}>) {
  const ranges:Array<{start:number;end:number;id:number;username:string}>=[];
  for(const user of [...users].sort((a,b)=>b.username.length-a.username.length)) {
    const escaped=user.username.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pattern=new RegExp(`(^|[\\s(])@${escaped}(?=$|[\\s.,!?;:()])`,'giu');
    for(const match of text.matchAll(pattern)){
      const start=match.index!+match[1].length,end=match.index!+match[0].length;
      if(ranges.some(r=>start<r.end&&end>r.start))continue;
      ranges.push({start,end,id:user.id,username:user.username});
    }
  }
  return ranges.sort((a,b)=>a.start-b.start);
}
