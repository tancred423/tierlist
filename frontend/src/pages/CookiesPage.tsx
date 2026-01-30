import { useI18n } from '../i18n';
import './FaqPage.css';

export function CookiesPage() {
  const { t } = useI18n();

  return (
    <div className="faq-page container">
      <h1>{t('cookies.title')}</h1>

      <div className="faq-list">
        <details className="faq-item" open>
          <summary>{t('cookies.whatAreCookies')}</summary>
          <div className="faq-answer">
            <p>{t('cookies.whatAreCookiesAnswer')}</p>
          </div>
        </details>

        <details className="faq-item" open>
          <summary>{t('cookies.whatWeUse')}</summary>
          <div className="faq-answer">
            <p>{t('cookies.whatWeUseAnswer')}</p>
            <ul>
              <li>
                <strong>{t('cookies.authCookie')}:</strong> {t('cookies.authCookieDesc')}
              </li>
            </ul>
          </div>
        </details>

        <details className="faq-item" open>
          <summary>{t('cookies.noThirdParty')}</summary>
          <div className="faq-answer">
            <p>{t('cookies.noThirdPartyAnswer')}</p>
          </div>
        </details>

        <details className="faq-item" open>
          <summary>{t('cookies.localStorage')}</summary>
          <div className="faq-answer">
            <p>{t('cookies.localStorageAnswer')}</p>
            <ul>
              <li>
                <strong>{t('cookies.theme')}:</strong> {t('cookies.themeDesc')}
              </li>
              <li>
                <strong>{t('cookies.language')}:</strong> {t('cookies.languageDesc')}
              </li>
              <li>
                <strong>{t('cookies.clockFormat')}:</strong> {t('cookies.clockFormatDesc')}
              </li>
            </ul>
          </div>
        </details>

        <details className="faq-item" open>
          <summary>{t('cookies.consent')}</summary>
          <div className="faq-answer">
            <p>{t('cookies.consentAnswer')}</p>
          </div>
        </details>
      </div>
    </div>
  );
}
