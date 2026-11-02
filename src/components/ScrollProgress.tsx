import { useEffect, useState } from 'react';
export function ScrollProgress(){
  const [w,setW]=useState(0);
  useEffect(()=>{
    const h=()=>{ const sc=window.scrollY/(document.documentElement.scrollHeight-window.innerHeight); setW(Math.max(0,Math.min(1,sc))); };
    window.addEventListener('scroll',h,{passive:true}); h(); return()=>window.removeEventListener('scroll',h);
  },[]);
  return <div className="scroll-progress" style={{transform:`scaleX(${w})`, width:'100%'}} aria-hidden="true"/>;
}
