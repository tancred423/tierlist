import { Hono } from "@hono/hono";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId, generateToken } from "../utils/id.ts";
import { requireAuth } from "../middleware/auth.ts";

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
  const publicTemplates = await db.query.templates.findMany({
    where: eq(schema.templates.isPublic, true),
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

  return c.json({ templates: publicTemplates });
});

templates.get("/my", requireAuth, async (c) => {
  const user = c.get("user")!;

  const userTemplates = await db.query.templates.findMany({
    where: eq(schema.templates.ownerId, user.userId),
    with: {
      tiers: true,
      columns: true,
      cards: true,
    },
    orderBy: [desc(schema.templates.createdAt)],
  });

  return c.json({ templates: userTemplates });
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
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (template.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
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

  await db.delete(schema.templates).where(eq(schema.templates.id, id));

  return c.json({ success: true });
});

export default templates;
