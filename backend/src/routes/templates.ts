import { Hono } from "@hono/hono";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId, generateToken } from "../utils/id.ts";
import { requireAuth } from "../middleware/auth.ts";
import { deleteTemplateImages } from "./uploads.ts";

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
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
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
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const [userTemplates, countResult] = await Promise.all([
    db.query.templates.findMany({
      where: eq(schema.templates.ownerId, user.userId),
      with: {
        tiers: true,
        columns: true,
        cards: true,
      },
      orderBy: [desc(schema.templates.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` })
      .from(schema.templates)
      .where(eq(schema.templates.ownerId, user.userId)),
  ]);

  const total = Number(countResult[0]?.count || 0);

  return c.json({
    templates: userTemplates,
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

  const templateId = generateId();
  const shareToken = generateToken();

  await db.insert(schema.templates).values({
    id: templateId,
    ownerId: user.userId,
    title: body.title || "New Tierlist",
    description: body.description || null,
    isPublic: body.isPublic ?? false,
    shareToken,
  });

  const tiers = body.tiers || DEFAULT_TIERS;
  for (let i = 0; i < tiers.length; i++) {
    await db.insert(schema.tiers).values({
      id: generateId(),
      templateId,
      name: tiers[i].name,
      color: tiers[i].color,
      orderIndex: i,
    });
  }

  const columns = body.columns || [{ name: null }];
  for (let i = 0; i < columns.length; i++) {
    await db.insert(schema.columns).values({
      id: generateId(),
      templateId,
      name: columns[i].name || null,
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

  await db.insert(schema.templates).values({
    id: newTemplateId,
    ownerId: user.userId,
    title: `${sourceTemplate.title} (Copy)`,
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

  await db.insert(schema.templates).values({
    id: newTemplateId,
    ownerId: user.userId,
    title: `${sourceTemplate.title} (Copy)`,
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

templates.post("/from-ranking/:rankingId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const rankingId = c.req.param("rankingId");

  const ranking = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, rankingId),
    with: {
      template: true,
    },
  });

  if (!ranking) {
    return c.json({ error: "Ranking not found" }, 404);
  }

  if (ranking.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const snapshot = ranking.templateSnapshot;
  if (!snapshot) {
    return c.json({ error: "This ranking has no template snapshot" }, 400);
  }

  const newTemplateId = generateId();
  const newShareToken = generateToken();

  await db.insert(schema.templates).values({
    id: newTemplateId,
    ownerId: user.userId,
    title: `${ranking.template.title} (From Ranking)`,
    description: ranking.template.description,
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
