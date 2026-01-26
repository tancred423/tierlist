import { useState } from 'react';
import { api } from '../api/client';
import { useI18n } from '../i18n';
import type { FilledTierlist } from '../types';
import './ShareModal.css';

interface ShareModalProps {
  tierlist: FilledTierlist;
  onClose: () => void;
  onUpdate: (updates: Partial<FilledTierlist>) => void;
}

export function ShareModal({ tierlist, onClose, onUpdate }: ShareModalProps) {
  const { t } = useI18n();
  const [viewEnabled, setViewEnabled] = useState(tierlist.viewShareEnabled);
  const [editEnabled, setEditEnabled] = useState(tierlist.editShareEnabled);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const viewUrl = `${window.location.origin}/share/view/${tierlist.viewShareToken}`;
  const editUrl = `${window.location.origin}/share/edit/${tierlist.editShareToken}`;

  async function handleViewToggle() {
    setIsUpdating(true);
    try {
      await api.updateFilledTierlist(tierlist.id, { viewShareEnabled: !viewEnabled });
      setViewEnabled(!viewEnabled);
      onUpdate({ viewShareEnabled: !viewEnabled });
    } catch (error) {
      console.error('Failed to update sharing:', error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleEditToggle() {
    setIsUpdating(true);
    try {
      await api.updateFilledTierlist(tierlist.id, { editShareEnabled: !editEnabled });
      setEditEnabled(!editEnabled);
      onUpdate({ editShareEnabled: !editEnabled });
    } catch (error) {
      console.error('Failed to update sharing:', error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRegenerateView() {
    if (
      !confirm(
        t('share.regenerateViewConfirm') ||
          'This will create a new link and invalidate the old one. Continue?',
      )
    )
      return;

    setIsUpdating(true);
    try {
      const { viewShareToken } = await api.regenerateTokens(tierlist.id, { regenerateView: true });
      onUpdate({ viewShareToken });
    } catch (error) {
      console.error('Failed to regenerate token:', error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRegenerateEdit() {
    if (
      !confirm(
        t('share.regenerateEditConfirm') ||
          'This will create a new link and remove all co-owners. Continue?',
      )
    )
      return;

    setIsUpdating(true);
    try {
      const { editShareToken } = await api.regenerateTokens(tierlist.id, { regenerateEdit: true });
      onUpdate({ editShareToken, coOwners: [] });
    } catch (error) {
      console.error('Failed to regenerate token:', error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleShareAsImage() {
    const gridContainer = document.querySelector('.tierlist-grid-container');
    if (!gridContainer) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(gridContainer as HTMLElement, {
        backgroundColor:
          getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() ||
          '#0f0f0f',
        scale: 2,
      });

      const link = document.createElement('a');
      link.download = `${tierlist.title.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to generate image:', error);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('tierlist.shareRanking')}</h2>
          <button onClick={onClose} className="btn btn-icon">
            ×
          </button>
        </div>
        <div className="modal-body">
          <section className="share-section">
            <button onClick={handleShareAsImage} className="btn btn-secondary share-image-btn">
              📷 {t('tierlist.shareAsImage')}
            </button>
          </section>

          <section className="share-section">
            <div className="share-section-header">
              <div>
                <h3>{t('tierlist.viewOnly')}</h3>
                <p>{t('share.anyoneCanView')}</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={viewEnabled}
                  onChange={handleViewToggle}
                  disabled={isUpdating}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            {viewEnabled && (
              <>
                <div className="share-link-row">
                  <input
                    type="text"
                    value={viewUrl}
                    readOnly
                    className="form-input share-link-input"
                  />
                  <button
                    onClick={() => copyToClipboard(viewUrl, 'view')}
                    className="btn btn-secondary"
                  >
                    {copied === 'view' ? t('tierlist.linkCopied') : t('tierlist.copyLink')}
                  </button>
                </div>
                <button
                  onClick={handleRegenerateView}
                  className="btn btn-secondary btn-sm regenerate-btn"
                  disabled={isUpdating}
                >
                  {t('tierlist.regenerate')}
                </button>
              </>
            )}
          </section>

          <section className="share-section">
            <div className="share-section-header">
              <div>
                <h3>{t('tierlist.editable')}</h3>
                <p>{t('share.anyoneCanEdit')}</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={editEnabled}
                  onChange={handleEditToggle}
                  disabled={isUpdating}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            {editEnabled && (
              <>
                <div className="share-link-row">
                  <input
                    type="text"
                    value={editUrl}
                    readOnly
                    className="form-input share-link-input"
                  />
                  <button
                    onClick={() => copyToClipboard(editUrl, 'edit')}
                    className="btn btn-secondary"
                  >
                    {copied === 'edit' ? t('tierlist.linkCopied') : t('tierlist.copyLink')}
                  </button>
                </div>
                <button
                  onClick={handleRegenerateEdit}
                  className="btn btn-secondary btn-sm regenerate-btn"
                  disabled={isUpdating}
                >
                  {t('tierlist.regenerate')}
                </button>
              </>
            )}
            {tierlist.coOwners && tierlist.coOwners.length > 0 && (
              <div className="co-owners-list">
                <h4>
                  {t('tierlist.coOwners')} ({tierlist.coOwners.length})
                </h4>
                <ul>
                  {tierlist.coOwners.map(co => (
                    <li key={co.userId}>{co.user.username}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
