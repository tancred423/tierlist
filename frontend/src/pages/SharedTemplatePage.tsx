import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import type { Template } from '../types';
import './SharedTemplatePage.css';

export function SharedTemplatePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, login } = useAuthStore();

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  const loadTemplate = useCallback(async () => {
    if (!token) return;

    try {
      const { template } = await api.getTemplateByShareToken(token);
      setTemplate(template);
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  async function handleCopy() {
    if (!token || !user) {
      login();
      return;
    }

    setIsCopying(true);
    try {
      const { template: newTemplate } = await api.copyTemplateByShareToken(token);
      navigate(`/template/${newTemplate.id}`);
    } catch (error) {
      console.error('Failed to copy template:', error);
      alert('Failed to copy template');
    } finally {
      setIsCopying(false);
    }
  }

  async function handleStartRanking() {
    if (!template) return;

    if (!user) {
      login();
      return;
    }

    try {
      const { filledTierlist } = await api.createFilledTierlist({
        templateId: template.id,
        shareToken: token,
      });
      navigate(`/tierlist/${filledTierlist.id}`);
    } catch (error) {
      console.error('Failed to create tierlist:', error);
    }
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>Template not found</h3>
          <p>This shared template link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container shared-template-page">
      <div className="shared-template-card card">
        <div className="template-header">
          <h1>{template.title}</h1>
          {template.owner && <p className="template-author">by {template.owner.username}</p>}
        </div>

        {template.description && <p className="template-description">{template.description}</p>}

        <div className="template-stats">
          <div className="stat">
            <span className="stat-value">{template.tiers.length}</span>
            <span className="stat-label">Tiers</span>
          </div>
          <div className="stat">
            <span className="stat-value">{template.columns.length}</span>
            <span className="stat-label">Columns</span>
          </div>
          <div className="stat">
            <span className="stat-value">{template.cards.length}</span>
            <span className="stat-label">Cards</span>
          </div>
        </div>

        <div className="template-preview">
          <h3>Tiers</h3>
          <div className="tiers-preview">
            {template.tiers.map(tier => (
              <div key={tier.id} className="tier-chip" style={{ backgroundColor: tier.color }}>
                {tier.name}
              </div>
            ))}
          </div>
        </div>

        <div className="template-actions">
          <button onClick={handleStartRanking} className="btn btn-primary">
            Start Ranking
          </button>
          <button onClick={handleCopy} className="btn btn-secondary" disabled={isCopying}>
            {isCopying ? 'Copying...' : 'Copy Template to My Account'}
          </button>
        </div>

        {!user && (
          <p className="login-hint">Login with Discord to create rankings or copy this template.</p>
        )}
      </div>
    </div>
  );
}
