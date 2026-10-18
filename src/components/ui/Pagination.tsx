import { Icon } from '../Icon';

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="icon-btn"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Page précédente"
      >
        <Icon name="chevron-left" size={18} />
      </button>
      {start > 1 && (
        <>
          <button type="button" className="page-num" onClick={() => onPage(1)}>
            1
          </button>
          {start > 2 && <span className="page-ellipsis">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`page-num${p === page ? ' page-num--active' : ''}`}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="page-ellipsis">…</span>}
          <button type="button" className="page-num" onClick={() => onPage(totalPages)}>
            {totalPages}
          </button>
        </>
      )}
      <button
        type="button"
        className="icon-btn"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Page suivante"
      >
        <Icon name="chevron-right" size={18} />
      </button>
    </nav>
  );
}
