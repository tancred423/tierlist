import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import './AccountPage.css';

export function AccountPage() {
  const { user, logout } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!user) {
    return null;
  }

  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : null;

  async function handleDeleteAccount() {
    const confirmed = confirm(t('account.deleteConfirm'));
    if (!confirmed) return;

    const doubleConfirmed = confirm(t('account.deleteDoubleConfirm'));
    if (!doubleConfirmed) return;

    setIsDeleting(true);
    try {
      await api.deleteAccount();
      logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to delete account:', error);
      setIsDeleting(false);
    }
  }

  return (
    <div className="account-page container">
      <h1>{t('account.title')}</h1>

      <div className="account-card card">
        <div className="account-profile">
          {user.avatar ? (
            <img
              src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=128`}
              alt={user.username}
              className="account-avatar"
            />
          ) : (
            <div className="account-avatar account-avatar-placeholder">
              {user.username[0].toUpperCase()}
            </div>
          )}
          <div className="account-info">
            <h2 className="account-username">{user.username}</h2>
            {memberSince && (
              <p className="account-member-since">
                {t('account.memberSince')} {memberSince}
              </p>
            )}
          </div>
        </div>

        <div className="account-actions">
          <button onClick={logout} className="btn btn-secondary">
            {t('common.logout')}
          </button>
        </div>
      </div>

      <div className="account-danger-zone card">
        <h3>{t('account.dangerZone')}</h3>
        <p className="text-muted">{t('account.deleteWarning')}</p>
        <button onClick={handleDeleteAccount} className="btn btn-danger" disabled={isDeleting}>
          {isDeleting ? t('account.deleting') : t('account.deleteAccount')}
        </button>
      </div>
    </div>
  );
}
