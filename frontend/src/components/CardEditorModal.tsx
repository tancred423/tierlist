import { useState, useRef, useEffect } from 'react';
import type { Card } from '../types';
import { useI18n } from '../i18n';

interface CardEditorModalProps {
  card: Card | null;
  onClose: () => void;
  onSave: (data: { title: string; imageUrl?: string; description?: string }) => void;
}

export function CardEditorModal({ card, onClose, onSave }: CardEditorModalProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(card?.title || '');
  const [imageUrl, setImageUrl] = useState(card?.imageUrl || '');
  const [description, setDescription] = useState(card?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!card && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [card]);

  const hasUnsavedChanges =
    title !== (card?.title || '') ||
    imageUrl !== (card?.imageUrl || '') ||
    description !== (card?.description || '');

  function handleClose() {
    if (hasUnsavedChanges) {
      if (confirm(t('template.unsavedChanges'))) {
        onClose();
      }
    } else {
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        imageUrl: imageUrl.trim() || undefined,
        description: description.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{card ? t('card.editCard') : t('card.addCard')}</h2>
          <button onClick={handleClose} className="btn btn-icon">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">{t('card.title')} *</label>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="form-input"
                placeholder={t('card.title')}
                maxLength={255}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('card.imageUrl')}</label>
              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="form-input"
                placeholder={t('card.imageUrlPlaceholder')}
              />
              {imageUrl && (
                <div style={{ marginTop: '0.5rem' }}>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '150px',
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover',
                    }}
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{t('card.description')}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="form-input"
                placeholder={t('card.descriptionPlaceholder')}
                rows={3}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={handleClose} className="btn btn-secondary">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? t('common.loading') : card ? t('common.save') : t('card.addCard')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
