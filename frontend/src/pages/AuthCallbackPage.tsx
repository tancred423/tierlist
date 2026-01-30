import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { initialize } = useAuthStore();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const redirectUrl = localStorage.getItem('auth_redirect') || '/my-tierlists';
    localStorage.removeItem('auth_redirect');

    initialize().then(user => {
      if (user) {
        navigate(redirectUrl, { replace: true });
      } else {
        navigate('/?error=auth_failed', { replace: true });
      }
    });
  }, [initialize, navigate]);

  return (
    <div className="loading-container">
      <div className="loading-spinner" />
    </div>
  );
}
