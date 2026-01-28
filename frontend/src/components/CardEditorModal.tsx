import { useState, useRef, useEffect, useCallback } from 'react';
import type { Card } from '../types';
import { useI18n } from '../i18n';
import { api } from '../api/client';

interface CardEditorModalProps {
  card: Card | null;
  templateId: string;
  onClose: () => void;
  onSave: (data: { title: string; imageUrl?: string; description?: string }) => void;
}

export function CardEditorModal({ card, templateId, onClose, onSave }: CardEditorModalProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(card?.title || '');
  const [imageUrl, setImageUrl] = useState(card?.imageUrl || '');
  const [description, setDescription] = useState(card?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<'url' | 'upload'>('url');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!card && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [card]);

  const uploadImage = useCallback(
    async (file: File | Blob) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        const result = await api.uploadImage(templateId, file);
        setImageUrl(result.imageUrl);
        setImageSource('upload');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [templateId],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadImage(file);
      }
    },
    [uploadImage],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            uploadImage(file);
          }
          break;
        }
      }
    },
    [uploadImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        uploadImage(file);
      }
    },
    [uploadImage],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          uploadImage(blob);
          return;
        }
      }
      setUploadError(t('card.noImageInClipboard'));
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setUploadError(t('card.clipboardPermissionDenied'));
      } else {
        setUploadError(t('card.clipboardError'));
      }
    }
  }, [uploadImage, t]);

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
              <label className="form-label">{t('card.image')}</label>

              <div className="image-source-tabs">
                <button
                  type="button"
                  className={`image-source-tab ${imageSource === 'url' ? 'active' : ''}`}
                  onClick={() => setImageSource('url')}
                >
                  {t('card.imageUrl')}
                </button>
                <button
                  type="button"
                  className={`image-source-tab ${imageSource === 'upload' ? 'active' : ''}`}
                  onClick={() => setImageSource('upload')}
                >
                  {t('card.imageUpload')}
                </button>
              </div>

              {imageSource === 'url' ? (
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  className="form-input"
                  placeholder={t('card.imageUrlPlaceholder')}
                />
              ) : (
                <div
                  ref={dropZoneRef}
                  className={`upload-dropzone ${isUploading ? 'uploading' : ''}`}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  tabIndex={0}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />

                  {isUploading ? (
                    <div className="upload-status">{t('card.uploading')}</div>
                  ) : (
                    <>
                      <div className="upload-icon">📷</div>
                      <div className="upload-text">{t('card.dragDropHint')}</div>
                      <div className="upload-buttons">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {t('card.chooseFile')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handlePasteFromClipboard}
                        >
                          {t('card.pasteFromClipboard')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {uploadError && <div className="upload-error">{uploadError}</div>}

              {imageUrl && (
                <div className="current-image-section">
                  <label className="form-label">{t('card.currentImage')}</label>
                  <div className="current-image-preview">
                    <img
                      src={
                        imageUrl.startsWith('/uploads/')
                          ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${imageUrl}`
                          : imageUrl
                      }
                      alt="Preview"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setImageUrl('')}
                    >
                      {t('card.removeImage')}
                    </button>
                  </div>
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
