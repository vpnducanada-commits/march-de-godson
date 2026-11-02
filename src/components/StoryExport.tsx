type Props={ title:string; price:string|null; image:string; url:string };
export function StoryExport({ title, price, image, url }: Props){
  const exportStory=async()=>{
    const c=document.createElement('canvas'); c.width=1080; c.height=1920;
    const ctx=c.getContext('2d')!;
    ctx.fillStyle='#0f1a33'; ctx.fillRect(0,0,1080,1920);
    ctx.fillStyle='#c8a84a'; ctx.fillRect(0,0,1080,14);
    const img=new Image(); img.crossOrigin='anonymous'; img.src=image;
    await new Promise<void>((res)=>{ img.onload=()=>res(); img.onerror=()=>res(); });
    try{ ctx.drawImage(img, 60, 100, 960, 960); }catch{}
    ctx.fillStyle='#fff'; ctx.font='bold 54px sans-serif';
    wrap(ctx, title, 60, 1120, 960, 70);
    if(price){ ctx.fillStyle='#c8a84a'; ctx.font='bold 64px sans-serif'; ctx.fillText(price, 60, 1380); }
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='28px sans-serif'; ctx.fillText(url, 60, 1840);
    ctx.fillStyle='#fff'; ctx.font='bold 30px sans-serif'; ctx.fillText('GODSON Marketplace', 60, 1780);
    const a=document.createElement('a'); a.download='story.png'; a.href=c.toDataURL('image/png'); a.click();
  };
  return <button type="button" className="btn btn--ghost btn--sm" onClick={exportStory}>Story 9:16</button>;
}
function wrap(ctx:CanvasRenderingContext2D, text:string, x:number, y:number, maxW:number, lh:number){
  const words=text.split(' '); let line=''; let yy=y;
  for(const w of words){ const test=line?line+' '+w:w; if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,x,yy); line=w; yy+=lh; } else line=test; }
  if(line) ctx.fillText(line,x,yy);
}
