import { useState } from 'react';
type Props = { src: string; alt: string; width?: number; height?: number; sizes?: string; className?: string; loading?: 'lazy' | 'eager'; priority?: boolean; style?: React.CSSProperties; onError?: () => void; };
function isSupabaseStorage(url: string) { return url.includes('supabase.co/storage/v1/object'); }
function transformed(url: string, w: number) { if (!isSupabaseStorage(url)) return url; const sep = url.includes('?') ? '&' : '?'; return `${url}${sep}width=${w}&quality=75&format=webp`; }
export function OptimizedImage({ src, alt, width, height, sizes, className, loading='lazy', priority, style, onError }: Props){
  const [loaded,setLoaded]=useState(false);
  const w = width || 400;
  const srcWebp = transformed(src, w);
  const srcSet = isSupabaseStorage(src) ? `${transformed(src, Math.round(w*0.75))} 300w, ${transformed(src, w)} ${w}w, ${transformed(src, w*2)} ${w*2}w` : undefined;
  return (
    <img
      src={srcWebp} srcSet={srcSet} sizes={sizes || `(max-width: 640px) 100vw, ${w}px`}
      alt={alt} width={width} height={height}
      loading={priority ? 'eager' : loading} decoding="async" fetchPriority={priority ? 'high' : undefined as any}
      className={`${className||''} img--fade ${loaded?'img--loaded':''}`.trim()}
      style={{...style, opacity: loaded?1:0, transition:'opacity 320ms ease, filter 320ms ease', filter: loaded?'none':'blur(6px)'}}
      onLoad={()=>setLoaded(true)}
      onError={onError}
    />
  );
}
