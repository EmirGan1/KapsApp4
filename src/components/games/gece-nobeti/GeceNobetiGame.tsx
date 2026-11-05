import {useRef,useState} from 'react';
import {ArrowLeft,Maximize,RefreshCw} from 'lucide-react';

export default function GeceNobetiGame({onBack}:{onBack:()=>void}){
 const container=useRef<HTMLDivElement>(null);
 const [version,setVersion]=useState(0),[message,setMessage]=useState('');
 const fullscreen=async()=>{try{if(!document.fullscreenElement)await container.current?.requestFullscreen();else await document.exitFullscreen();}catch{setMessage('Bu tarayıcı tam ekranı desteklemiyor. Oyuna bu görünümde devam edebilirsin.');}};
 return <div ref={container} className="flex flex-col flex-1 min-h-0 w-full bg-black text-white overflow-hidden">
  <header className="flex flex-wrap items-center gap-2 p-2 sm:p-3 bg-slate-950 border-b border-slate-800 shrink-0">
   <button onClick={onBack} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold"><ArrowLeft size={16}/>Oyunlara dön</button>
   <h1 className="flex-1 min-w-0 text-sm sm:text-base font-bold">Gece Nöbeti · İnkılap Tarihi</h1>
   <button onClick={()=>setVersion(v=>v+1)} aria-label="Oyunu yeniden başlat" className="p-2 rounded-lg bg-slate-800"><RefreshCw size={18}/></button>
   <button onClick={fullscreen} aria-label="Tam ekran" className="p-2 rounded-lg bg-slate-800"><Maximize size={18}/></button>
  </header>
  {message&&<p role="status" className="p-2 text-xs text-amber-200 shrink-0">{message}</p>}
  <iframe key={version} title="Gece Nöbeti: İnkılap Tarihi oyunu" src="/games/gece-nobeti/index.html" sandbox="allow-scripts" allow="autoplay; fullscreen" allowFullScreen className="flex-1 min-h-0 w-full border-0"/>
 </div>;
}
