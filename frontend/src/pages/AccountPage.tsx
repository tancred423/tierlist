import { useState } from 'react';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import { getDisplayName } from '../types';
import './AccountPage.css';

export function AccountPage() {
  const { user, setUser } = useAuthStore();
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : null;
  const displayName = getDisplayName(user);

  async function handleSaveNickname() {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const { user: updatedUser } = await api.updateProfile({ nickname });
      setUser(updatedUser);
      setSaveMessage(t('account.nicknameSaved'));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update nickname:', error);
      setSaveMessage(t('account.nicknameError'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = confirm(t('account.deleteConfirm'));
    if (!confirmed) return;

    const doubleConfirmed = confirm(t('account.deleteDoubleConfirm'));
    if (!doubleConfirmed) return;

    setIsDeleting(true);
    try {
      await api.deleteAccount();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_redirect');
      window.location.href = '/';
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
              alt={displayName}
              className="account-avatar"
            />
          ) : (
            <div className="account-avatar account-avatar-placeholder">
              {displayName[0].toUpperCase()}
            </div>
          )}
          <div className="account-info">
            <h2 className="account-username">{displayName}</h2>
            {user.nickname && (
              <p className="account-discord-name">
                {t('account.discordName')}: {user.username}
              </p>
            )}
            {memberSince && (
              <p className="account-member-since">
                {t('account.memberSince')} {memberSince}
              </p>
            )}
          </div>
        </div>

        <div className="account-actions">
          <button
            onClick={() => {
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_redirect');
              window.location.href = '/';
            }}
            className="btn btn-secondary"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>

      <div className="account-settings card">
        <h3>{t('account.settings')}</h3>
        <div className="form-group">
          <label htmlFor="nickname">{t('account.nickname')}</label>
          <p className="text-muted form-hint">{t('account.nicknameHint')}</p>
          <div className="nickname-input-row">
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder={user.username}
              maxLength={255}
              className="input"
            />
            <button onClick={handleSaveNickname} className="btn btn-primary" disabled={isSaving}>
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
          {saveMessage && <p className="save-message">{saveMessage}</p>}
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
