import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
export function SavedSearchBanner({ query }: { query: string }){
  const [saved, setSaved] = useState<string[]>(()=>{ try{ return JSON.parse(localStorage.getItem('gm_saved_searches')||'[]'); }catch{ return []; }});
  const isSaved = query ? saved.includes(query) : false;
  const toggle=()=>{
    if(!query) return;
    const next = isSaved ? saved.filter(s=>s!==query) : [...saved, query].slice(0,5);
    setSaved(next); localStorage.setItem('gm_saved_searches', JSON.stringify(next));
    if(!isSaved && 'Notification' in window && Notification.permission==='default') Notification.requestPermission().catch(()=>{});
  };
  if(!query) return null;
  return <div style={{display:'flex',gap:8,alignItems:'center',margin:'10px 0',padding:'10px 12px',background:'var(--amber-bg)',borderRadius:10,border:'1px solid #f0dfae', flexWrap:'wrap'}}>
    <Icon name="bell" size={14}/><span style={{fontSize:13}}>Alerte : <strong>{query}</strong> — sois notifié des nouvelles annonces</span>
    <button className="btn btn--sm btn--primary" onClick={toggle}>{isSaved? 'Alerte activée' : 'Créer alerte'}</button>
    {isSaved && <Link to="/annonces" className="form-hint">Gérer mes alertes</Link>}
    {saved.length>0 && !isSaved && <span className="form-hint">{saved.length}/5 alertes</span>}
  </div>;
}
