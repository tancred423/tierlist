import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken, initialize } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      setToken(token);
      initialize().then(() => {
        navigate('/');
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
