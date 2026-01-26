import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { TemplateEditorPage } from './pages/TemplateEditorPage';
import { TierlistEditorPage } from './pages/TierlistEditorPage';
import { SharedTemplatePage } from './pages/SharedTemplatePage';
import { SharedTierlistPage } from './pages/SharedTierlistPage';
import { AccountPage } from './pages/AccountPage';
import { FaqPage } from './pages/FaqPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  const { initialize, isInitialized, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized || isLoading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route path="template/new" element={<TemplateEditorPage />} />
        <Route path="template/:id" element={<TemplateEditorPage />} />
        <Route path="tierlist/:id" element={<TierlistEditorPage />} />
        <Route path="share/template/:token" element={<SharedTemplatePage />} />
        <Route path="share/view/:token" element={<SharedTierlistPage mode="view" />} />
        <Route path="share/edit/:token" element={<SharedTierlistPage mode="edit" />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
