export interface User {
  id: string;
  discordId: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  discriminator: string | null;
  createdAt?: string;
}

export function getDisplayName(
  user: User | { username: string; nickname?: string | null },
): string {
  return user.nickname || user.username;
}

export interface Tier {
  id: string;
  templateId: string;
  name: string;
  color: string;
  orderIndex: number;
}

export interface Column {
  id: string;
  templateId: string;
  name: string | null;
  color: string | null;
  orderIndex: number;
}

export interface Card {
  id: string;
  templateId: string;
  title: string;
  imageUrl: string | null;
  description: string | null;
  orderIndex: number;
}

export interface Template {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: User;
  tiers: Tier[];
  columns: Column[];
  cards: Card[];
}

export interface CardPlacement {
  id: string;
  filledTierlistId: string;
  cardId: string;
  tierId: string | null;
  columnId: string | null;
  orderIndex: number;
}

export interface CoOwner {
  userId: string;
  user: User;
  joinedAt: string;
}

export interface TemplateSnapshot {
  tiers: { id: string; name: string; color: string; orderIndex: number }[];
  columns: { id: string; name: string | null; color?: string | null; orderIndex: number }[];
  cards: {
    id: string;
    title: string;
    imageUrl: string | null;
    description: string | null;
    orderIndex: number;
  }[];
  snapshotAt: string;
}

export interface AdditionalCard {
  id: string;
  title: string;
  imageUrl?: string | null;
  description?: string | null;
}

export interface DisplaySettings {
  tierOrder?: string[];
  columnOrder?: string[];
  tierOverrides?: Record<string, { name?: string; color?: string }>;
  columnOverrides?: Record<string, { name?: string }>;
  additionalCards?: AdditionalCard[];
  additionalTiers?: Array<{ id: string; name: string; color: string; orderIndex: number }>;
  hiddenTierIds?: string[];
  additionalColumns?: Array<{ id: string; name: string; orderIndex: number }>;
  hiddenColumnIds?: string[];
  removedCardIds?: string[];
  cardOverrides?: Record<string, { title?: string; imageUrl?: string; description?: string }>;
}

export interface FilledTierlist {
  id: string;
  templateId: string | null;
  ownerId: string;
  title: string;
  templateSnapshot?: TemplateSnapshot | null;
  displaySettings?: DisplaySettings | null;
  viewShareToken: string | null;
  viewShareEnabled: boolean;
  editShareToken: string | null;
  editShareEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  template: Template | null;
  owner?: User;
  placements: CardPlacement[];
  coOwners?: CoOwner[];
  isShared?: boolean;
}

export interface CreateTemplateData {
  title: string;
  description?: string;
  isPublic?: boolean;
  tiers?: { name: string; color: string }[];
  columns?: { name: string | null }[];
}

export interface UpdateTemplateData {
  title?: string;
  description?: string;
  isPublic?: boolean;
  tiers?: { id?: string; name: string; color: string }[];
  columns?: { id?: string; name: string | null }[];
}

export interface CreateCardData {
  title: string;
  imageUrl?: string;
  description?: string;
  orderIndex?: number;
}

export interface UpdateCardData {
  title?: string;
  imageUrl?: string;
  description?: string;
  orderIndex?: number;
}

export interface PlacementData {
  cardId: string;
  tierId: string | null;
  columnId: string | null;
  orderIndex: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
