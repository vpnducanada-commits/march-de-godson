import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
export function RouteProgress(){
  const { pathname } = useLocation();
  const [active,setActive]=useState(false);
  const [done,setDone]=useState(false);
  const prev = useRef(pathname);
  useEffect(()=>{
    if(prev.current !== pathname){
      setActive(true); setDone(false);
      const t=setTimeout(()=>{ setDone(true); setTimeout(()=>setActive(false), 320); }, 520);
      prev.current=pathname;
      return ()=>clearTimeout(t);
    }
  },[pathname]);
  if(!active) return null;
  return <div className={`route-progress ${done ? 'route-progress--done' : ''}`} aria-hidden="true" />;
}
