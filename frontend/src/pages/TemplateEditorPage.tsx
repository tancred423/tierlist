import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import type { Template, Tier, Column, Card } from '../types';
import { CardEditorModal } from '../components/CardEditorModal';
import './TemplateEditorPage.css';

const DEFAULT_TIERS = [
  { name: 'S', color: '#ff7f7f' },
  { name: 'A', color: '#ffbf7f' },
  { name: 'B', color: '#ffff7f' },
  { name: 'C', color: '#7fff7f' },
  { name: 'D', color: '#7fbfff' },
  { name: 'F', color: '#ff7fff' },
];

interface SortableTierRowProps {
  tier: Tier;
  index: number;
  onUpdate: (index: number, field: 'name' | 'color', value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  t: (key: string) => string;
}

function SortableTierRow({ tier, index, onUpdate, onRemove, canRemove, t }: SortableTierRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tier.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="tier-editor-row">
      <div className="drag-handle" {...attributes} {...listeners}>
        ⋮⋮
      </div>
      <input
        type="color"
        value={tier.color}
        onChange={e => onUpdate(index, 'color', e.target.value)}
        className="color-input"
      />
      <input
        type="text"
        value={tier.name}
        onChange={e => onUpdate(index, 'name', e.target.value)}
        className="form-input"
        placeholder={t('template.tierName')}
        maxLength={255}
      />
      <button
        onClick={() => onRemove(index)}
        className="btn btn-icon btn-danger btn-sm"
        disabled={!canRemove}
        title={t('common.delete')}
      >
        ×
      </button>
    </div>
  );
}

interface SortableColumnRowProps {
  column: Column;
  index: number;
  onUpdate: (index: number, name: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  t: (key: string) => string;
}

function SortableColumnRow({
  column,
  index,
  onUpdate,
  onRemove,
  canRemove,
  t,
}: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="column-editor-row">
      <div className="drag-handle" {...attributes} {...listeners}>
        ⋮⋮
      </div>
      <span className="column-number">#{index + 1}</span>
      <input
        type="text"
        value={column.name || ''}
        onChange={e => onUpdate(index, e.target.value)}
        className="form-input"
        placeholder={t('template.columnName')}
        maxLength={255}
      />
      <button
        onClick={() => onRemove(index)}
        className="btn btn-icon btn-danger btn-sm"
        disabled={!canRemove}
        title={t('common.delete')}
      >
        ×
      </button>
    </div>
  );
}

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();

  const isNewTemplate = !id || id === 'new';

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isCreatingRef = useRef(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const createNewTemplate = useCallback(async () => {
    try {
      const { template: newTemplate } = await api.createTemplate({
        title: t('template.newTemplate'),
        tiers: DEFAULT_TIERS.map(tier => ({ name: tier.name, color: tier.color })),
        columns: [{ name: '' }],
      });
      navigate(`/template/${newTemplate.id}`, { replace: true });
    } catch (error) {
      console.error('Failed to create template:', error);
      navigate('/');
    }
  }, [navigate, t]);

  const loadTemplate = useCallback(async () => {
    if (!id || id === 'new') return;

    try {
      const { template } = await api.getTemplate(id);
      setTemplate(template);
      setTitle(template.title);
      setDescription(template.description || '');
      setIsPublic(template.isPublic);
      setTiers(template.tiers);
      setColumns(template.columns);
      setCards(template.cards);
    } catch (error) {
      console.error('Failed to load template:', error);
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (isNewTemplate) {
      if (!isCreatingRef.current) {
        isCreatingRef.current = true;
        createNewTemplate();
      }
    } else {
      loadTemplate();
    }
  }, [user, navigate, isNewTemplate, createNewTemplate, loadTemplate]);

  async function handleSave() {
    if (!title.trim()) {
      alert(t('template.templateTitle') + ' required');
      return;
    }

    if (!id || !template) return;

    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await api.updateTemplate(id, {
        title,
        description: description || undefined,
        isPublic,
        tiers: tiers.map(t => ({ id: t.id, name: t.name, color: t.color })),
        columns: columns.map(c => ({ id: c.id, name: c.name })),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save template:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  }

  function updateTier(index: number, field: 'name' | 'color', value: string) {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  }

  function addTier() {
    setTiers([
      ...tiers,
      {
        id: `new-${Date.now()}`,
        templateId: template?.id || '',
        name: `Tier ${tiers.length + 1}`,
        color: '#888888',
        orderIndex: tiers.length,
      },
    ]);
  }

  function removeTier(index: number) {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  }

  function addColumn() {
    setColumns([
      ...columns,
      {
        id: `new-${Date.now()}`,
        templateId: template?.id || '',
        name: '',
        orderIndex: columns.length,
      },
    ]);
  }

  function removeColumn(index: number) {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  }

  function updateColumn(index: number, name: string) {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], name };
    setColumns(newColumns);
  }

  function handleTierDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTiers(items => {
        const oldIndex = items.findIndex(t => t.id === active.id);
        const newIndex = items.findIndex(t => t.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns(items => {
        const oldIndex = items.findIndex(c => c.id === active.id);
        const newIndex = items.findIndex(c => c.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  async function handleAddCard() {
    setEditingCard(null);
    setShowCardModal(true);
  }

  async function handleEditCard(card: Card) {
    setEditingCard(card);
    setShowCardModal(true);
  }

  async function handleSaveCard(data: { title: string; imageUrl?: string; description?: string }) {
    if (!template) return;

    try {
      if (editingCard) {
        const { card } = await api.updateCard(editingCard.id, data);
        setCards(cards.map(c => (c.id === card.id ? card : c)));
      } else {
        const { card } = await api.createCard(template.id, data);
        setCards([...cards, card]);
      }
      setShowCardModal(false);
      setEditingCard(null);
    } catch (error) {
      console.error('Failed to save card:', error);
      alert('Failed to save card');
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!confirm('Delete this card?')) return;

    try {
      await api.deleteCard(cardId);
      setCards(cards.filter(c => c.id !== cardId));
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  }

  async function handleStartRanking() {
    if (!template) return;

    try {
      const { filledTierlist } = await api.createFilledTierlist({
        templateId: template.id,
      });
      navigate(`/tierlist/${filledTierlist.id}`);
    } catch (error) {
      console.error('Failed to create tierlist:', error);
    }
  }

  async function handleDeleteTemplate() {
    if (!template) return;
    if (!confirm(t('template.deleteConfirm'))) return;

    try {
      await api.deleteTemplate(template.id);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert(t('errors.failedToDelete'));
    }
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!isNewTemplate && !template) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>{t('errors.failedToLoad')}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container template-editor-page">
      <div className="editor-header">
        <div>
          <h1>{t('template.editTemplate')}</h1>
        </div>
        <div className="editor-actions">
          <button onClick={handleDeleteTemplate} className="btn btn-danger">
            {t('common.delete')}
          </button>
          <button onClick={handleStartRanking} className="btn btn-secondary">
            {t('home.startRanking')}
          </button>
          <button
            onClick={handleSave}
            className={`btn ${saveStatus === 'saved' ? 'btn-success' : saveStatus === 'error' ? 'btn-danger' : 'btn-primary'}`}
            disabled={isSaving}
          >
            {saveStatus === 'saving'
              ? t('common.saving')
              : saveStatus === 'saved'
                ? t('common.saved')
                : saveStatus === 'error'
                  ? t('errors.failedToSave')
                  : t('common.save')}
          </button>
        </div>
      </div>

      <div className="editor-grid">
        <section className="editor-section title-section card">
          <h2>{t('template.templateTitle')}</h2>
          <div className="form-group">
            <label className="form-label">{t('template.templateTitle')}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="form-input"
              maxLength={255}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('template.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="form-input"
              placeholder={t('template.descriptionPlaceholder')}
              rows={2}
            />
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
              />
              <span>{t('template.isPublic')}</span>
            </label>
          </div>
        </section>

        <section className="editor-section card">
          <div className="section-header">
            <h2>
              {t('template.tiers')} ({tiers.length})
            </h2>
            <button onClick={addTier} className="btn btn-secondary btn-sm">
              + {t('template.addTier')}
            </button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTierDragEnd}
          >
            <SortableContext items={tiers.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="tiers-list">
                {tiers.map((tier, index) => (
                  <SortableTierRow
                    key={tier.id}
                    tier={tier}
                    index={index}
                    onUpdate={updateTier}
                    onRemove={removeTier}
                    canRemove={tiers.length > 1}
                    t={t}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <section className="editor-section card">
          <div className="section-header">
            <h2>
              {t('template.columns')} ({columns.length})
            </h2>
            <button onClick={addColumn} className="btn btn-secondary btn-sm">
              + {t('template.addColumn')}
            </button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="columns-list">
                {columns.map((column, index) => (
                  <SortableColumnRow
                    key={column.id}
                    column={column}
                    index={index}
                    onUpdate={updateColumn}
                    onRemove={removeColumn}
                    canRemove={columns.length > 1}
                    t={t}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <section className="editor-section card cards-section">
          <div className="section-header">
            <h2>
              {t('template.cards')} ({cards.length})
            </h2>
            <button onClick={handleAddCard} className="btn btn-secondary btn-sm">
              + {t('template.addCard')}
            </button>
          </div>
          {cards.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <p>{t('template.noCards')}</p>
              <p className="text-muted">{t('template.addCardsHint')}</p>
            </div>
          ) : (
            <div className="cards-grid">
              {cards.map(card => (
                <div key={card.id} className="card-preview">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.title} className="card-image" />
                  ) : (
                    <div className="card-image-placeholder">No Image</div>
                  )}
                  <div className="card-content">
                    <h4>{card.title}</h4>
                    {card.description && <p className="card-description">{card.description}</p>}
                  </div>
                  <div className="card-actions">
                    <button
                      onClick={() => handleEditCard(card)}
                      className="btn btn-secondary btn-sm"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="btn btn-danger btn-sm"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showCardModal && (
        <CardEditorModal
          card={editingCard}
          onClose={() => {
            setShowCardModal(false);
            setEditingCard(null);
          }}
          onSave={handleSaveCard}
        />
      )}
    </div>
  );
}
