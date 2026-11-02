import { useEffect, useState } from 'react';

export function Confetti({ show, onDone }: { show: boolean; onDone?: () => void }) {
  const [particles] = useState(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    color: ['#f5b82e','#2563eb','#16a34a','#0a1633','#ef4444'][i%5],
    rot: Math.random()*360,
    dur: 0.8 + Math.random()*0.6,
  })));
  useEffect(()=>{ if(show && onDone){ const t=setTimeout(onDone, 1800); return ()=>clearTimeout(t); }},[show,onDone]);
  if(!show) return null;
  return (
    <div style={{position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:9999}}>
      {particles.map(p=>(
        <span key={p.id} style={{
          position:'absolute', left:`${p.left}%`, top:-12, width:8, height:12, background:p.color, borderRadius:2,
          transform:`rotate(${p.rot}deg)`,
          animation:`confetti-fall ${p.dur}s cubic-bezier(0.2,0.8,0.2,1) ${p.delay}s forwards`,
        }}/>
      ))}
      <style>{`@keyframes confetti-fall{0%{transform: translateY(-20px) rotate(0deg); opacity:1}100%{transform: translateY(110vh) rotate(720deg); opacity:0}}`}</style>
    </div>
  );
}
