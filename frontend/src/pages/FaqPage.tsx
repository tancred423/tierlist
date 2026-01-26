import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import './FaqPage.css';

export function FaqPage() {
  const { user } = useAuthStore();
  const { t } = useI18n();

  const supportUrl = import.meta.env.VITE_SUPPORT_URL;

  return (
    <div className="faq-page container">
      <h1>{t('faq.title')}</h1>

      <div className="faq-list">
        <details className="faq-item" open>
          <summary>{t('faq.whatIsThis')}</summary>
          <div className="faq-answer">
            <p>{t('faq.whatIsThisAnswer1')}</p>
            <ul>
              <li><strong>{t('faq.templates')}:</strong> {t('faq.templatesDesc')}</li>
              <li><strong>{t('faq.rankings')}:</strong> {t('faq.rankingsDesc')}</li>
              <li><strong>{t('faq.sharing')}:</strong> {t('faq.sharingDesc')}</li>
            </ul>
          </div>
        </details>

        <details className="faq-item">
          <summary>{t('faq.howToUse')}</summary>
          <div className="faq-answer">
            <ol>
              <li><strong>{t('faq.step1Title')}:</strong> {t('faq.step1Desc')}</li>
              <li><strong>{t('faq.step2Title')}:</strong> {t('faq.step2Desc')}</li>
              <li><strong>{t('faq.step3Title')}:</strong> {t('faq.step3Desc')}</li>
              <li><strong>{t('faq.step4Title')}:</strong> {t('faq.step4Desc')}</li>
            </ol>
          </div>
        </details>

        <details className="faq-item">
          <summary>{t('faq.howToGetHelp')}</summary>
          <div className="faq-answer">
            <p>
              {t('faq.howToGetHelpAnswer')}{' '}
              {supportUrl ? (
                <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                  {t('faq.supportServer')}
                </a>
              ) : (
                t('faq.supportServer')
              )}
              .
            </p>
          </div>
        </details>

        <details className="faq-item">
          <summary>{t('faq.howToReportBug')}</summary>
          <div className="faq-answer">
            <p>
              {t('faq.howToReportBugAnswer')}{' '}
              {supportUrl ? (
                <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                  {t('faq.supportServer')}
                </a>
              ) : (
                t('faq.supportServer')
              )}
              .
            </p>
          </div>
        </details>

        <details className="faq-item">
          <summary>{t('faq.howToFeatureRequest')}</summary>
          <div className="faq-answer">
            <p>
              {t('faq.howToFeatureRequestAnswer')}{' '}
              {supportUrl ? (
                <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                  {t('faq.supportServer')}
                </a>
              ) : (
                t('faq.supportServer')
              )}
              .
            </p>
          </div>
        </details>

        <details className="faq-item">
          <summary>{t('faq.howToDeleteAccount')}</summary>
          <div className="faq-answer">
            {user ? (
              <p>
                {t('faq.howToDeleteAccountLoggedIn')}{' '}
                <Link to="/account">{t('faq.accountPage')}</Link>.
              </p>
            ) : (
              <p>{t('faq.howToDeleteAccountLoggedOut')}</p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
