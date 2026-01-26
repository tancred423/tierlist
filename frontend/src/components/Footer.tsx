import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import './Footer.css';

export function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  const termsUrl = import.meta.env.VITE_TERMS_URL;
  const privacyUrl = import.meta.env.VITE_PRIVACY_URL;
  const supportUrl = import.meta.env.VITE_SUPPORT_URL;

  return (
    <footer className="footer">
      <div className="footer-content">
        <span className="footer-copyright">© {currentYear} Tancred</span>
        <nav className="footer-links">
          <Link to="/faq">{t('footer.faq')}</Link>
          {termsUrl && (
            <a href={termsUrl} target="_blank" rel="noopener noreferrer">
              {t('footer.terms')}
            </a>
          )}
          {privacyUrl && (
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
              {t('footer.privacy')}
            </a>
          )}
          {supportUrl && (
            <a href={supportUrl} target="_blank" rel="noopener noreferrer">
              {t('footer.support')}
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
