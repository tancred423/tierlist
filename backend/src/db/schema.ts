import { boolean, int, json, mysqlTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  discordId: varchar("discord_id", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull(),
  nickname: varchar("nickname", { length: 255 }),
  discriminator: varchar("discriminator", { length: 10 }),
  avatar: varchar("avatar", { length: 255 }),
  email: varchar("email", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const templates = mysqlTable("templates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: varchar("owner_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false).notNull(),
  shareToken: varchar("share_token", { length: 64 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const tiers = mysqlTable("tiers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  templateId: varchar("template_id", { length: 36 }).notNull().references(() => templates.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  orderIndex: int("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const columns = mysqlTable("columns", {
  id: varchar("id", { length: 36 }).primaryKey(),
  templateId: varchar("template_id", { length: 36 }).notNull().references(() => templates.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  color: varchar("color", { length: 7 }),
  orderIndex: int("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cards = mysqlTable("cards", {
  id: varchar("id", { length: 36 }).primaryKey(),
  templateId: varchar("template_id", { length: 36 }).notNull().references(() => templates.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  imageUrl: text("image_url"),
  description: text("description"),
  orderIndex: int("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export interface DisplaySettings {
  tierOrder?: string[];
  columnOrder?: string[];
  tierOverrides?: Record<string, { name?: string; color?: string }>;
  columnOverrides?: Record<string, { name?: string }>;
  additionalCards?: { id: string; title: string; imageUrl?: string | null; description?: string | null }[];
  additionalTiers?: { id: string; name: string; color: string; orderIndex: number }[];
  hiddenTierIds?: string[];
  additionalColumns?: { id: string; name: string; orderIndex: number }[];
  hiddenColumnIds?: string[];
  removedCardIds?: string[];
  cardOverrides?: Record<string, { title?: string; imageUrl?: string; description?: string }>;
}

export interface TemplateSnapshot {
  tiers: { id: string; name: string; color: string; orderIndex: number }[];
  columns: { id: string; name: string | null; color?: string | null; orderIndex: number }[];
  cards: { id: string; title: string; imageUrl: string | null; description: string | null; orderIndex: number }[];
  snapshotAt: string;
}

export const filledTierlists = mysqlTable("filled_tierlists", {
  id: varchar("id", { length: 36 }).primaryKey(),
  templateId: varchar("template_id", { length: 36 }).references(() => templates.id, { onDelete: "set null" }),
  ownerId: varchar("owner_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  templateSnapshot: json("template_snapshot").$type<TemplateSnapshot>(),
  displaySettings: json("display_settings").$type<DisplaySettings>(),
  viewShareToken: varchar("view_share_token", { length: 64 }).unique(),
  viewShareEnabled: boolean("view_share_enabled").default(false).notNull(),
  editShareToken: varchar("edit_share_token", { length: 64 }).unique(),
  editShareEnabled: boolean("edit_share_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const filledTierlistCoOwners = mysqlTable("list_co_owners", {
  listId: varchar("list_id", { length: 36 }).notNull().references(() => filledTierlists.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.listId, table.userId] }),
}));

export const cardPlacements = mysqlTable("placements", {
  id: varchar("id", { length: 36 }).primaryKey(),
  listId: varchar("list_id", { length: 36 }).notNull().references(() => filledTierlists.id, { onDelete: "cascade" }),
  cardId: varchar("card_id", { length: 36 }).notNull(),
  tierId: varchar("tier_id", { length: 36 }),
  columnId: varchar("column_id", { length: 36 }),
  orderIndex: int("order_index").notNull().default(0),
});

export const usersRelations = relations(users, ({ many }) => ({
  templates: many(templates),
  filledTierlists: many(filledTierlists),
  coOwnedLists: many(filledTierlistCoOwners),
  likes: many(templateLikes),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  owner: one(users, {
    fields: [templates.ownerId],
    references: [users.id],
  }),
  tiers: many(tiers),
  columns: many(columns),
  cards: many(cards),
  filledTierlists: many(filledTierlists),
  likes: many(templateLikes),
}));

export const tiersRelations = relations(tiers, ({ one, many }) => ({
  template: one(templates, {
    fields: [tiers.templateId],
    references: [templates.id],
  }),
  placements: many(cardPlacements),
}));

export const columnsRelations = relations(columns, ({ one, many }) => ({
  template: one(templates, {
    fields: [columns.templateId],
    references: [templates.id],
  }),
  placements: many(cardPlacements),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  template: one(templates, {
    fields: [cards.templateId],
    references: [templates.id],
  }),
  placements: many(cardPlacements),
}));

export const filledTierlistsRelations = relations(filledTierlists, ({ one, many }) => ({
  template: one(templates, {
    fields: [filledTierlists.templateId],
    references: [templates.id],
  }),
  owner: one(users, {
    fields: [filledTierlists.ownerId],
    references: [users.id],
  }),
  placements: many(cardPlacements),
  coOwners: many(filledTierlistCoOwners),
}));

export const filledTierlistCoOwnersRelations = relations(filledTierlistCoOwners, ({ one }) => ({
  filledTierlist: one(filledTierlists, {
    fields: [filledTierlistCoOwners.listId],
    references: [filledTierlists.id],
  }),
  user: one(users, {
    fields: [filledTierlistCoOwners.userId],
    references: [users.id],
  }),
}));

export const cardPlacementsRelations = relations(cardPlacements, ({ one }) => ({
  filledTierlist: one(filledTierlists, {
    fields: [cardPlacements.listId],
    references: [filledTierlists.id],
  }),
  card: one(cards, {
    fields: [cardPlacements.cardId],
    references: [cards.id],
  }),
  tier: one(tiers, {
    fields: [cardPlacements.tierId],
    references: [tiers.id],
  }),
  column: one(columns, {
    fields: [cardPlacements.columnId],
    references: [columns.id],
  }),
}));

export const templateLikes = mysqlTable("template_likes", {
  templateId: varchar("template_id", { length: 36 }).notNull().references(() => templates.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.templateId, table.userId] }),
}));

export const templateLikesRelations = relations(templateLikes, ({ one }) => ({
  template: one(templates, {
    fields: [templateLikes.templateId],
    references: [templates.id],
  }),
  user: one(users, {
    fields: [templateLikes.userId],
    references: [users.id],
  }),
}));
