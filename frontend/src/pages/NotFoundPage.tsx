import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import './NotFoundPage.css';

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <div className="not-found-page container">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">{t('notFound.title')}</h2>
        <p className="not-found-message">{t('notFound.message')}</p>
        <Link to="/" className="btn btn-primary">
          {t('notFound.goHome')}
        </Link>
      </div>
    </div>
  );
}
