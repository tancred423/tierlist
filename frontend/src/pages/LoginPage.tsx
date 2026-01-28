import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import './LoginPage.css';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const { t } = useI18n();

  const redirectTo = searchParams.get('redirect') || '/';

  useEffect(() => {
    if (user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, redirectTo]);

  function handleLogin() {
    localStorage.setItem('auth_redirect', redirectTo);
    login();
  }

  if (user) {
    return null;
  }

  return (
    <div className="login-page container">
      <div className="login-card card">
        <div className="login-icon">🔒</div>
        <h1>{t('login.title')}</h1>
        <p className="login-message">{t('login.message')}</p>
        <button onClick={handleLogin} className="btn btn-primary login-btn">
          {t('auth.loginWithDiscord')}
        </button>
        <p className="login-hint">{t('login.hint')}</p>
      </div>
    </div>
  );
}
