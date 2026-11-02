export function scorePublish(v:{title:string; description:string; price:string|null; city:string; images:number; category:string}){
  let s=0;
  if(v.title.trim().length>=10) s+=20; else if(v.title.trim().length>=3) s+=10;
  if(v.description.trim().length>=40) s+=25; else if(v.description.trim().length>=15) s+=12;
  if(v.price && v.price!=='') s+=20;
  if(v.city) s+=15;
  if(v.images>=1) s+=10; if(v.images>=3) s+=5;
  if(v.category) s+=10;
  return Math.min(100,s);
}
export function CompletenessBar({ score }:{score:number}){
  const tips=[];
  if(score<100){
    if(score<40) tips.push('Ajoute un prix et une ville pour être trouvé');
    else if(score<70) tips.push('Ajoute 2-3 photos nettes pour +40% de contacts');
    else tips.push('Presque parfait — vérifie ta description');
  } else tips.push('Annonce prête à publier ✓');
  const color = score<40?'#e05':score<70?'#d4a017':'#1a9e5a';
  return (
    <div className="complete-bar" aria-live="polite">
      <div className="complete-bar__head"><span>Complétude</span><strong>{score}%</strong></div>
      <div className="complete-bar__track"><div className="complete-bar__fill" style={{width:`${score}%`, background:color}}/></div>
      <p className="complete-bar__tip">{tips[0]}</p>
    </div>
  );
}
