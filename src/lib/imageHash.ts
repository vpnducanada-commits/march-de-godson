export async function imageHash(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('load')); i.src = url; });
  URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
  const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, 8, 8);
  const data = ctx.getImageData(0, 0, 8, 8).data;
  const gray: number[] = []; for (let i = 0; i < data.length; i += 4) { gray.push(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]); }
  const avg = gray.reduce((a,b)=>a+b,0)/gray.length;
  let hash = ''; for (const v of gray) hash += v > avg ? '1' : '0'; return hash;
}
export function hamming(a:string,b:string){ let d=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) d++; return d; }
