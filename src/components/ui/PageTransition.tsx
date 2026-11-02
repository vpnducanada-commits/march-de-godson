import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
export function PageTransition({ children }: { children: ReactNode }){
  const { pathname } = useLocation();
  const [display,setDisplay]=useState(children);
  const [phase,setPhase]=useState<'enter'|'exit'>('enter');
  const [prevPath,setPrevPath]=useState(pathname);
  useEffect(()=>{
    if(pathname !== prevPath){
      setPhase('exit');
      const t=setTimeout(()=>{ setDisplay(children); setPhase('enter'); setPrevPath(pathname); }, 140);
      return ()=>clearTimeout(t);
    } else {
      setDisplay(children);
    }
  },[pathname, children, prevPath]);
  return <div className={`page-transition page-transition--${phase}`}>{display}</div>;
}
