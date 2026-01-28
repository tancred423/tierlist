import { useI18n } from '../i18n';
import './Pagination.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  const { t } = useI18n();

  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <div className="pagination-info">
        {t('pagination.showing')} {start} {t('pagination.to')} {end} {t('pagination.of')} {total}{' '}
        {t('pagination.results')}
      </div>
      <div className="pagination-controls">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          {t('pagination.previous')}
        </button>
        <span className="pagination-current">
          {t('pagination.page')} {page} {t('pagination.of')} {totalPages}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {t('pagination.next')}
        </button>
      </div>
    </div>
  );
}
