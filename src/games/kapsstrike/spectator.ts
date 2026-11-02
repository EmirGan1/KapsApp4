import type {BombMatch} from './bomb';
import type {PlayerSnapshot, StrikeTeam} from './types';

/** Select by identity, never by the order of delayed render snapshots. */
export class TeamSpectator {
  private targets:PlayerSnapshot[]=[];
  private targetId?:string;
  private context='';

  reset(){this.targets=[];this.targetId=undefined;this.context='';}
  get count(){return this.targets.length;}
  get index(){return this.targets.findIndex(p=>p.id===this.targetId);}
  get target(){return this.targets.find(p=>p.id===this.targetId);}

  update(bomb:BombMatch|undefined,id:string,team:StrikeTeam,hp:number,players:PlayerSnapshot[]){
    if(!bomb||bomb.phase==='finished'||hp>0||team==='none'){this.reset();return undefined;}
    const context=`${bomb.round}:${team}:${id}`;
    if(context!==this.context){this.reset();this.context=context;}
    this.targets=players.filter(p=>p.id!==id&&p.team===team&&p.hp>0&&p.connected!==false)
      .sort((a,b)=>a.userId-b.userId||a.id.localeCompare(b.id));
    if(!this.target)this.targetId=this.targets[0]?.id;
    return this.target;
  }

  cycle(direction=1){
    if(this.count)this.targetId=this.targets[(Math.max(0,this.index)+(direction<0?-1:1)+this.count)%this.count].id;
    return this.target;
  }
}
