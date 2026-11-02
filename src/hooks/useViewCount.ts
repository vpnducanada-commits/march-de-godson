import { useEffect, useState } from 'react';
export function useViewCount(slug:string){
  const [views,setViews]=useState(()=>{ try{ const v=localStorage.getItem('gm_views_'+slug); return v?parseInt(v,10):0; }catch{return 0}});
  const [favs,setFavs]=useState(0);
  useEffect(()=>{
    const key='gm_seen_'+slug;
    try{
      if(!sessionStorage.getItem(key)){
        sessionStorage.setItem(key,'1');
        const nv=views+1; setViews(nv); localStorage.setItem('gm_views_'+slug, String(nv));
        fetch('/api/view',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({slug})}).catch(()=>{});
      }
    }catch{}
    try{ const favsRaw=localStorage.getItem('gm_favs'); if(favsRaw){ const arr=JSON.parse(favsRaw); setFavs(Array.isArray(arr)?arr.length:0); } }catch{}
  },[slug]);
  return { views, favs };
}
