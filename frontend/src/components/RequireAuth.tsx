import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    const redirectPath = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectPath)}`} replace />;
  }

  return <>{children}</>;
}
