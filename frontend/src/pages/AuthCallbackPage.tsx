import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken, initialize } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      navigate('/');
      return;
    }

    const tokenKey = `auth_processed_${token.substring(0, 20)}`;
    if (sessionStorage.getItem(tokenKey)) {
      return;
    }
    sessionStorage.setItem(tokenKey, 'true');

    const redirectUrl = localStorage.getItem('auth_redirect') || '/my-tierlists';
    localStorage.removeItem('auth_redirect');

    setToken(token);
    initialize().then(() => {
      sessionStorage.removeItem(tokenKey);
      navigate(redirectUrl, { replace: true });
    });
  }, [searchParams, setToken, initialize, navigate]);

  return (
    <div className="loading-container">
      <div className="loading-spinner" />
    </div>
  );
}
