import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken, initialize } = useAuthStore();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const token = searchParams.get('token');

    if (token) {
      processedRef.current = true;

      const redirectUrl = localStorage.getItem('auth_redirect');
      localStorage.removeItem('auth_redirect');

      setToken(token);
      initialize().then(() => {
        navigate(redirectUrl || '/', { replace: true });
      });
    } else {
      navigate('/');
    }
  }, [searchParams, setToken, initialize, navigate]);

  return (
    <div className="loading-container">
      <div className="loading-spinner" />
    </div>
  );
}
