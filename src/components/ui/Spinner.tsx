export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="spinner__label">{label}</span>
    </div>
  );
}
