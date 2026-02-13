const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  async getDiscordAuthUrl(): Promise<{ url: string }> {
    return this.request('/api/auth/discord');
  }

  async getCurrentUser(): Promise<{ user: import('../types').User | null }> {
    return this.request('/api/auth/me');
  }

  async getPublicTemplates(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'popular' | 'newest' | 'oldest';
  }): Promise<{
    templates: (import('../types').Template & { likeCount: number })[];
    pagination: import('../types').Pagination;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.search) queryParams.set('search', params.search);
    if (params?.sort) queryParams.set('sort', params.sort);
    const query = queryParams.toString();
    return this.request(`/api/templates/public${query ? `?${query}` : ''}`);
  }

  async getMyTemplates(params?: { page?: number; limit?: number }): Promise<{
    templates: import('../types').Template[];
    pagination: import('../types').Pagination;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    const query = queryParams.toString();
    return this.request(`/api/templates/my${query ? `?${query}` : ''}`);
  }

  async getTemplate(id: string): Promise<{ template: import('../types').Template }> {
    return this.request(`/api/templates/${id}`);
  }

  async getTemplateByShareToken(token: string): Promise<{ template: import('../types').Template }> {
    return this.request(`/api/templates/share/${token}`);
  }

  async copyTemplateByShareToken(
    shareToken: string,
  ): Promise<{ template: import('../types').Template }> {
    return this.request(`/api/templates/share/${shareToken}/copy`, { method: 'POST' });
  }

  async createTemplate(
    data: import('../types').CreateTemplateData,
  ): Promise<{ template: import('../types').Template }> {
    return this.request('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTemplate(
    id: string,
    data: import('../types').UpdateTemplateData,
  ): Promise<{ template: import('../types').Template }> {
    return this.request(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/templates/${id}`, { method: 'DELETE' });
  }

  async copyTemplate(id: string): Promise<{ template: import('../types').Template }> {
    return this.request(`/api/templates/${id}/copy`, { method: 'POST' });
  }

  async getTemplateLike(id: string): Promise<{ liked: boolean }> {
    return this.request(`/api/templates/${id}/like`);
  }

  async toggleTemplateLike(id: string): Promise<{ liked: boolean; likeCount: number }> {
    return this.request(`/api/templates/${id}/like`, {
      method: 'POST',
    });
  }

  async createTemplateFromTierlist(
    tierlistId: string,
  ): Promise<{ template: import('../types').Template }> {
    return this.request(`/api/templates/from-tierlist/${tierlistId}`, { method: 'POST' });
  }

  async createCard(
    templateId: string,
    data: import('../types').CreateCardData,
  ): Promise<{ card: import('../types').Card }> {
    return this.request(`/api/cards/${templateId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCard(
    id: string,
    data: import('../types').UpdateCardData,
  ): Promise<{ card: import('../types').Card }> {
    return this.request(`/api/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCard(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/cards/${id}`, { method: 'DELETE' });
  }

  async reorderCards(
    templateId: string,
    cardOrders: { id: string; orderIndex: number }[],
  ): Promise<{ success: boolean }> {
    return this.request(`/api/cards/${templateId}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ cardOrders }),
    });
  }

  async getMyFilledTierlists(params?: { page?: number; limit?: number }): Promise<{
    tierlists: (import('../types').FilledTierlist & { isCoOwner: boolean })[];
    owned: import('../types').FilledTierlist[];
    shared: import('../types').FilledTierlist[];
    pagination: import('../types').Pagination;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    const query = queryParams.toString();
    return this.request(`/api/filled-tierlists/my${query ? `?${query}` : ''}`);
  }

  async getFilledTierlist(
    id: string,
  ): Promise<{ filledTierlist: import('../types').FilledTierlist; canEdit: boolean }> {
    return this.request(`/api/filled-tierlists/${id}`);
  }

  async getFilledTierlistByViewToken(
    token: string,
  ): Promise<{ filledTierlist: import('../types').FilledTierlist; canEdit: boolean }> {
    return this.request(`/api/filled-tierlists/view/${token}`);
  }

  async getFilledTierlistByEditToken(
    token: string,
  ): Promise<{ filledTierlist: import('../types').FilledTierlist; canEdit: boolean }> {
    return this.request(`/api/filled-tierlists/edit/${token}`);
  }

  async createFilledTierlist(data: {
    templateId: string;
    title?: string;
    shareToken?: string;
  }): Promise<{ filledTierlist: import('../types').FilledTierlist }> {
    return this.request('/api/filled-tierlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFilledTierlist(
    id: string,
    data: { title?: string; viewShareEnabled?: boolean; editShareEnabled?: boolean },
  ): Promise<{ success: boolean }> {
    return this.request(`/api/filled-tierlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updatePlacements(
    id: string,
    placements: import('../types').PlacementData[],
  ): Promise<{ placements: import('../types').CardPlacement[] }> {
    return this.request(`/api/filled-tierlists/${id}/placements`, {
      method: 'PUT',
      body: JSON.stringify({ placements }),
    });
  }

  async regenerateTokens(
    id: string,
    data: { regenerateView?: boolean; regenerateEdit?: boolean },
  ): Promise<{ viewShareToken: string; editShareToken: string }> {
    return this.request(`/api/filled-tierlists/${id}/regenerate-tokens`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteFilledTierlist(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/filled-tierlists/${id}`, { method: 'DELETE' });
  }

  async leaveFilledTierlist(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/filled-tierlists/${id}/leave`, { method: 'POST' });
  }

  async copyFilledTierlist(
    id: string,
  ): Promise<{ filledTierlist: import('../types').FilledTierlist }> {
    return this.request(`/api/filled-tierlists/${id}/copy`, { method: 'POST' });
  }

  async deleteAccount(): Promise<{ success: boolean }> {
    return this.request('/api/auth/me', { method: 'DELETE' });
  }

  async updateProfile(data: { nickname?: string }): Promise<{ user: import('../types').User }> {
    return this.request('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadImage(
    templateId: string,
    file: File | Blob,
  ): Promise<{ imageUrl: string; size: number }> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_URL}/api/uploads/${templateId}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('File too large for server. Try a smaller image or compress it first.');
      }
      if (response.status === 507) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Server storage is full. Please use a URL instead.');
      }
      const error = await response
        .json()
        .catch(() => ({ error: `Upload failed (${response.status})` }));
      throw new Error(error.error || `Upload failed (${response.status})`);
    }

    return response.json();
  }

  async getStorageInfo(): Promise<{
    used: number;
    limit: number;
    usedGB: number;
    limitGB: number;
    available: boolean;
  }> {
    return this.request('/api/uploads/storage');
  }
}

export const api = new ApiClient();
