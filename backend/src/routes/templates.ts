import { Hono } from "@hono/hono";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId, generateToken } from "../utils/id.ts";
import { requireAuth } from "../middleware/auth.ts";
import { deleteTemplateImages } from "./uploads.ts";
import {
  clampPaginationLimit,
  LIMITS,
  validateArrayLength,
  validateOptionalString,
  validateString,
} from "../utils/validation.ts";

const templates = new Hono();

const DEFAULT_TIERS = [
  { name: "S", color: "#FF7F7F" },
  { name: "A", color: "#FFBF7F" },
  { name: "B", color: "#FFDF7F" },
  { name: "C", color: "#FFFF7F" },
  { name: "D", color: "#BFFF7F" },
  { name: "E", color: "#7FBFFF" },
  { name: "F", color: "#7F7FFF" },
];

templates.get("/public", async (c) => {
  const search = c.req.query("search")?.trim() || "";
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = clampPaginationLimit(parseInt(c.req.query("limit") || "12"));
  const sort = c.req.query("sort") || "popular";
  const offset = (page - 1) * limit;

  let whereClause = eq(schema.templates.isPublic, true);
  if (search) {
    whereClause = and(
      eq(schema.templates.isPublic, true),
      or(
        like(schema.templates.title, `%${search}%`),
        like(schema.templates.description, `%${search}%`),
      ),
    )!;
  }

  try {
    const publicTemplates = await db.query.templates.findMany({
      where: whereClause,
      with: {
        owner: {
          columns: { id: true, username: true, nickname: true, avatar: true },
        },
        tiers: true,
        columns: true,
        cards: true,
        likes: true,
      },
    });

    const templatesWithLikeCount = publicTemplates.map((template) => {
      const likeCount = (template.likes || []).length;
      const { likes: _likes, ...rest } = template;
      return { ...rest, likeCount };
    });

    if (sort === "newest") {
      templatesWithLikeCount.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "oldest") {
      templatesWithLikeCount.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      templatesWithLikeCount.sort((a, b) => b.likeCount - a.likeCount);
    }

    const total = templatesWithLikeCount.length;
    const paginatedTemplates = templatesWithLikeCount.slice(offset, offset + limit);

    return c.json({
      templates: paginatedTemplates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching public templates with likes, falling back:", error);
    const publicTemplates = await db.query.templates.findMany({
      where: whereClause,
      with: {
        owner: {
          columns: { id: true, username: true, nickname: true, avatar: true },
        },
        tiers: true,
        columns: true,
        cards: true,
      },
      orderBy: [desc(schema.templates.createdAt)],
    });

    const templatesWithLikeCount = publicTemplates.map((template) => ({
      ...template,
      likeCount: 0,
    }));

    const total = templatesWithLikeCount.length;
    const paginatedTemplates = templatesWithLikeCount.slice(offset, offset + limit);

    return c.json({
      templates: paginatedTemplates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
});

templates.get("/my", requireAuth, async (c) => {
  const user = c.get("user")!;
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = clampPaginationLimit(parseInt(c.req.query("limit") || "12"));
  const sort = c.req.query("sort") || "updated_desc";
  const offset = (page - 1) * limit;

  const allTemplates = await db.query.templates.findMany({
    where: eq(schema.templates.ownerId, user.userId),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
  });

  allTemplates.sort((a, b) => {
    switch (sort) {
      case "created_desc":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "created_asc":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "title_asc":
        return a.title.localeCompare(b.title);
      case "title_desc":
        return b.title.localeCompare(a.title);
      case "updated_desc":
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  const total = allTemplates.length;
  const paginatedTemplates = allTemplates.slice(offset, offset + limit);

  return c.json({
    templates: paginatedTemplates,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

templates.post("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();

  const titleResult = validateString(body.title || "New Tierlist", LIMITS.TITLE, "Title");
  if (!titleResult.valid) return c.json({ error: titleResult.error }, 400);

  const descResult = validateOptionalString(body.description, LIMITS.DESCRIPTION, "Description");
  if (!descResult.valid) return c.json({ error: descResult.error }, 400);

  const tiers = body.tiers || DEFAULT_TIERS;
  const tiersLimitResult = validateArrayLength(tiers, LIMITS.MAX_TIERS, "Tiers");
  if (!tiersLimitResult.valid) return c.json({ error: tiersLimitResult.error }, 400);

  const columns = body.columns || [{ name: null }];
  const columnsLimitResult = validateArrayLength(columns, LIMITS.MAX_COLUMNS, "Columns");
  if (!columnsLimitResult.valid) return c.json({ error: columnsLimitResult.error }, 400);

  for (const tier of tiers) {
    const nameResult = validateString(tier.name, LIMITS.TIER_NAME, "Tier name");
    if (!nameResult.valid) return c.json({ error: nameResult.error }, 400);
    const colorResult = validateString(tier.color, LIMITS.COLOR, "Tier color");
    if (!colorResult.valid) return c.json({ error: colorResult.error }, 400);
  }

  for (const column of columns) {
    const nameResult = validateOptionalString(column.name, LIMITS.COLUMN_NAME, "Column name");
    if (!nameResult.valid) return c.json({ error: nameResult.error }, 400);
  }

  const templateId = generateId();
  const shareToken = generateToken();

  await db.insert(schema.templates).values({
    id: templateId,
    ownerId: user.userId,
    title: titleResult.value,
    description: descResult.value,
    isPublic: body.isPublic ?? false,
    shareToken,
  });

  for (let i = 0; i < tiers.length; i++) {
    await db.insert(schema.tiers).values({
      id: generateId(),
      templateId,
      name: tiers[i].name,
      color: tiers[i].color,
      orderIndex: i,
    });
  }

  for (let i = 0; i < columns.length; i++) {
    await db.insert(schema.columns).values({
      id: generateId(),
      templateId,
      name: columns[i].name || null,
      color: columns[i].color || null,
      orderIndex: i,
    });
  }

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, templateId),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
  });

  return c.json({ template }, 201);
});

templates.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, id),
    with: {
      owner: {
        columns: { id: true, username: true, nickname: true, avatar: true },
      },
      tiers: {
        orderBy: [schema.tiers.orderIndex],
      },
      columns: {
        orderBy: [schema.columns.orderIndex],
      },
      cards: {
        orderBy: [schema.cards.orderIndex],
      },
    },
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (!template.isPublic && template.ownerId !== user?.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  return c.json({ template });
});

templates.get("/share/:token", async (c) => {
  const token = c.req.param("token");

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.shareToken, token),
    with: {
      owner: {
        columns: { id: true, username: true, nickname: true, avatar: true },
      },
      tiers: {
        orderBy: [schema.tiers.orderIndex],
      },
      columns: {
        orderBy: [schema.columns.orderIndex],
      },
      cards: {
        orderBy: [schema.cards.orderIndex],
      },
    },
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  return c.json({ template });
});

templates.post("/share/:token/copy", requireAuth, async (c) => {
  const user = c.get("user")!;
  const token = c.req.param("token");

  const sourceTemplate = await db.query.templates.findFirst({
    where: eq(schema.templates.shareToken, token),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
  });

  if (!sourceTemplate) {
    return c.json({ error: "Template not found" }, 404);
  }

  const newTemplateId = generateId();
  const newShareToken = generateToken();
  const copyTitle = `${sourceTemplate.title} (Copy)`.slice(0, LIMITS.TITLE);

  await db.insert(schema.templates).values({
    id: newTemplateId,
    ownerId: user.userId,
    title: copyTitle,
    description: sourceTemplate.description,
    isPublic: false,
    shareToken: newShareToken,
  });

  const tierIdMap = new Map<string, string>();
  for (const tier of sourceTemplate.tiers) {
    const newTierId = generateId();
    tierIdMap.set(tier.id, newTierId);
    await db.insert(schema.tiers).values({
      id: newTierId,
      templateId: newTemplateId,
      name: tier.name,
      color: tier.color,
      orderIndex: tier.orderIndex,
    });
  }

  const columnIdMap = new Map<string, string>();
  for (const column of sourceTemplate.columns) {
    const newColumnId = generateId();
    columnIdMap.set(column.id, newColumnId);
    await db.insert(schema.columns).values({
      id: newColumnId,
      templateId: newTemplateId,
      name: column.name,
      color: column.color,
      orderIndex: column.orderIndex,
    });
  }

  for (const card of sourceTemplate.cards) {
    await db.insert(schema.cards).values({
      id: generateId(),
      templateId: newTemplateId,
      title: card.title,
      imageUrl: card.imageUrl,
      description: card.description,
      orderIndex: card.orderIndex,
    });
  }

  const newTemplate = await db.query.templates.findFirst({
    where: eq(schema.templates.id, newTemplateId),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
  });

  return c.json({ template: newTemplate }, 201);
});

templates.post("/:id/copy", requireAuth, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const sourceTemplate = await db.query.templates.findFirst({
    where: eq(schema.templates.id, id),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
  });

  if (!sourceTemplate) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (!sourceTemplate.isPublic && sourceTemplate.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const newTemplateId = generateId();
  const newShareToken = generateToken();
  const copyTitle = `${sourceTemplate.title} (Copy)`.slice(0, LIMITS.TITLE);

  await db.insert(schema.templates).values({
    id: newTemplateId,
    ownerId: user.userId,
    title: copyTitle,
    description: sourceTemplate.description,
    isPublic: false,
    shareToken: newShareToken,
  });

  for (const tier of sourceTemplate.tiers) {
    await db.insert(schema.tiers).values({
      id: generateId(),
      templateId: newTemplateId,
      name: tier.name,
      color: tier.color,
      orderIndex: tier.orderIndex,
    });
  }

  for (const column of sourceTemplate.columns) {
    await db.insert(schema.columns).values({
      id: generateId(),
      templateId: newTemplateId,
      name: column.name,
      color: column.color,
      orderIndex: column.orderIndex,
    });
  }

  for (const card of sourceTemplate.cards) {
    await db.insert(schema.cards).values({
      id: generateId(),
      templateId: newTemplateId,
      title: card.title,
      imageUrl: card.imageUrl,
      description: card.description,
      orderIndex: card.orderIndex,
    });
  }

  const newTemplate = await db.query.templates.findFirst({
    where: eq(schema.templates.id, newTemplateId),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
  });

  return c.json({ template: newTemplate }, 201);
});

templates.post("/from-tierlist/:tierlistId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const tierlistId = c.req.param("tierlistId");

  const tierlist = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, tierlistId),
    with: {
      template: true,
    },
  });

  if (!tierlist) {
    return c.json({ error: "Tierlist not found" }, 404);
  }

  if (tierlist.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const snapshot = tierlist.templateSnapshot;
  if (!snapshot) {
    return c.json({ error: "This tierlist has no template snapshot" }, 400);
  }

  const newTemplateId = generateId();
  const newShareToken = generateToken();

  const templateTitle = tierlist.template?.title ?? tierlist.title;
  const templateDescription = tierlist.template?.description ?? null;
  const newTitle = `${templateTitle} (From Tierlist)`.slice(0, LIMITS.TITLE);

  await db.insert(schema.templates).values({
    id: newTemplateId,
    ownerId: user.userId,
    title: newTitle,
    description: templateDescription,
    isPublic: false,
    shareToken: newShareToken,
  });

  for (const tier of snapshot.tiers) {
    await db.insert(schema.tiers).values({
      id: generateId(),
      templateId: newTemplateId,
      name: tier.name,
      color: tier.color,
      orderIndex: tier.orderIndex,
    });
  }

  for (const column of snapshot.columns) {
    await db.insert(schema.columns).values({
      id: generateId(),
      templateId: newTemplateId,
      name: column.name,
      color: column.color || null,
      orderIndex: column.orderIndex,
    });
  }

  for (const card of snapshot.cards) {
    await db.insert(schema.cards).values({
      id: generateId(),
      templateId: newTemplateId,
      title: card.title,
      imageUrl: card.imageUrl,
      description: card.description,
      orderIndex: card.orderIndex,
    });
  }

  const newTemplate = await db.query.templates.findFirst({
    where: eq(schema.templates.id, newTemplateId),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
  });

  return c.json({ template: newTemplate }, 201);
});

templates.put("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json();

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, id),
    with: { cards: true },
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (template.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (template.cards.length === 0) {
    return c.json({ error: "At least one card is required" }, 400);
  }

  if (body.title !== undefined) {
    const titleResult = validateString(body.title, LIMITS.TITLE, "Title");
    if (!titleResult.valid) return c.json({ error: titleResult.error }, 400);
  }

  if (body.description !== undefined) {
    const descResult = validateOptionalString(body.description, LIMITS.DESCRIPTION, "Description");
    if (!descResult.valid) return c.json({ error: descResult.error }, 400);
  }

  if (body.tiers) {
    const tiersLimitResult = validateArrayLength(body.tiers, LIMITS.MAX_TIERS, "Tiers");
    if (!tiersLimitResult.valid) return c.json({ error: tiersLimitResult.error }, 400);
    for (const tier of body.tiers) {
      const nameResult = validateString(tier.name, LIMITS.TIER_NAME, "Tier name");
      if (!nameResult.valid) return c.json({ error: nameResult.error }, 400);
      const colorResult = validateString(tier.color, LIMITS.COLOR, "Tier color");
      if (!colorResult.valid) return c.json({ error: colorResult.error }, 400);
    }
  }

  if (body.columns) {
    const columnsLimitResult = validateArrayLength(body.columns, LIMITS.MAX_COLUMNS, "Columns");
    if (!columnsLimitResult.valid) return c.json({ error: columnsLimitResult.error }, 400);
    for (const column of body.columns) {
      const nameResult = validateOptionalString(column.name, LIMITS.COLUMN_NAME, "Column name");
      if (!nameResult.valid) return c.json({ error: nameResult.error }, 400);
    }
  }

  await db.update(schema.templates)
    .set({
      title: body.title ?? template.title,
      description: body.description ?? template.description,
      isPublic: body.isPublic ?? template.isPublic,
      updatedAt: new Date(),
    })
    .where(eq(schema.templates.id, id));

  if (body.tiers) {
    await db.delete(schema.tiers).where(eq(schema.tiers.templateId, id));
    for (let i = 0; i < body.tiers.length; i++) {
      const tier = body.tiers[i];
      await db.insert(schema.tiers).values({
        id: tier.id || generateId(),
        templateId: id,
        name: tier.name,
        color: tier.color,
        orderIndex: i,
      });
    }
  }

  if (body.columns) {
    await db.delete(schema.columns).where(eq(schema.columns.templateId, id));
    for (let i = 0; i < body.columns.length; i++) {
      const column = body.columns[i];
      await db.insert(schema.columns).values({
        id: column.id || generateId(),
        templateId: id,
        name: column.name,
        color: column.color || null,
        orderIndex: i,
      });
    }
  }

  const updatedTemplate = await db.query.templates.findFirst({
    where: eq(schema.templates.id, id),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
  });

  return c.json({ template: updatedTemplate });
});

templates.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, id),
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (template.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  await deleteTemplateImages(id);

  await db.delete(schema.templates).where(eq(schema.templates.id, id));

  return c.json({ success: true });
});

templates.post("/batch-likes", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();

  if (!Array.isArray(body.templateIds) || body.templateIds.length > 100) {
    return c.json({ error: "templateIds must be an array (max 100)" }, 400);
  }

  if (body.templateIds.length === 0) {
    return c.json({ likedIds: [] });
  }

  const likes = await db.query.templateLikes.findMany({
    where: and(
      eq(schema.templateLikes.userId, user.userId),
      inArray(schema.templateLikes.templateId, body.templateIds),
    ),
  });

  const likedIds = likes.map((l) => l.templateId);
  return c.json({ likedIds });
});

templates.get("/:id/like", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const like = await db.query.templateLikes.findFirst({
    where: and(
      eq(schema.templateLikes.templateId, id),
      eq(schema.templateLikes.userId, user.userId),
    ),
  });

  return c.json({ liked: !!like });
});

templates.post("/:id/like", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, id),
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (!template.isPublic) {
    return c.json({ error: "Can only like public templates" }, 403);
  }

  const existingLike = await db.query.templateLikes.findFirst({
    where: and(
      eq(schema.templateLikes.templateId, id),
      eq(schema.templateLikes.userId, user.userId),
    ),
  });

  if (existingLike) {
    await db.delete(schema.templateLikes).where(
      and(
        eq(schema.templateLikes.templateId, id),
        eq(schema.templateLikes.userId, user.userId),
      ),
    );
  } else {
    await db.insert(schema.templateLikes).values({
      templateId: id,
      userId: user.userId,
    });
  }

  const allLikes = await db.query.templateLikes.findMany({
    where: eq(schema.templateLikes.templateId, id),
  });

  return c.json({ liked: !existingLike, likeCount: allLikes.length });
});

export default templates;
