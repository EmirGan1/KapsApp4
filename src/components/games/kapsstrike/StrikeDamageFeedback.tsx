export default function StrikeDamageFeedback({hp,dead,tick,hurt}:{hp:number;dead:boolean;tick:number;hurt?:{until:number;damage?:number}}){
 if(dead||hp<=0)return null;
 return <>
  {hurt&&hurt.until>tick&&<div aria-hidden="true" className="ks-hurt-vignette" style={{opacity:Math.min(.95,.45+(hurt.damage||10)/100)}}/>}
  {hp<=10&&<div aria-hidden="true" className={'ks-critical-health '+(hp<=5?'ks-critical-health-severe':'')}/>}
 </>;
}
