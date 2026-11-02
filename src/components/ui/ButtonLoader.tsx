export function ButtonLoader({ label="Chargement…" }: { label?: string }){
  return <span style={{display:'inline-flex',alignItems:'center',gap:8}}><span className="btn-spinner" aria-hidden="true"/><span>{label}</span></span>;
}
