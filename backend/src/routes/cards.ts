import { Hono } from "@hono/hono";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId } from "../utils/id.ts";
import { requireAuth } from "../middleware/auth.ts";
import { deleteCardImage } from "./uploads.ts";

const cards = new Hono();

cards.post("/:templateId", requireAuth, async (c) => {
  const templateId = c.req.param("templateId");
  const user = c.get("user")!;
  const body = await c.req.json();

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, templateId),
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (template.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const existingCards = await db.query.cards.findMany({
    where: eq(schema.cards.templateId, templateId),
  });
  const maxOrder = existingCards.length > 0 ? Math.max(...existingCards.map((c) => c.orderIndex)) + 1 : 0;

  const cardId = generateId();

  await db.insert(schema.cards).values({
    id: cardId,
    templateId,
    title: body.title || "New Card",
    imageUrl: body.imageUrl || null,
    description: body.description || null,
    orderIndex: body.orderIndex ?? maxOrder,
  });

  await db.update(schema.templates)
    .set({ updatedAt: new Date() })
    .where(eq(schema.templates.id, templateId));

  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });

  return c.json({ card }, 201);
});

cards.put("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json();

  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, id),
    with: {
      template: true,
    },
  });

  if (!card) {
    return c.json({ error: "Card not found" }, 404);
  }

  if (card.template.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (body.imageUrl !== undefined && body.imageUrl !== card.imageUrl) {
    await deleteCardImage(card.imageUrl);
  }

  await db.update(schema.cards)
    .set({
      title: body.title ?? card.title,
      imageUrl: body.imageUrl ?? card.imageUrl,
      description: body.description ?? card.description,
      orderIndex: body.orderIndex ?? card.orderIndex,
    })
    .where(eq(schema.cards.id, id));

  await db.update(schema.templates)
    .set({ updatedAt: new Date() })
    .where(eq(schema.templates.id, card.templateId));

  const updatedCard = await db.query.cards.findFirst({
    where: eq(schema.cards.id, id),
  });

  return c.json({ card: updatedCard });
});

cards.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, id),
    with: {
      template: true,
    },
  });

  if (!card) {
    return c.json({ error: "Card not found" }, 404);
  }

  if (card.template.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const templateId = card.templateId;

  await deleteCardImage(card.imageUrl);

  await db.delete(schema.cards).where(eq(schema.cards.id, id));

  await db.update(schema.templates)
    .set({ updatedAt: new Date() })
    .where(eq(schema.templates.id, templateId));

  return c.json({ success: true });
});

cards.put("/:templateId/reorder", requireAuth, async (c) => {
  const templateId = c.req.param("templateId");
  const user = c.get("user")!;
  const body = await c.req.json();

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, templateId),
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (template.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const cardOrders: { id: string; orderIndex: number }[] = body.cardOrders;

  for (const { id, orderIndex } of cardOrders) {
    await db.update(schema.cards)
      .set({ orderIndex })
      .where(and(eq(schema.cards.id, id), eq(schema.cards.templateId, templateId)));
  }

  await db.update(schema.templates)
    .set({ updatedAt: new Date() })
    .where(eq(schema.templates.id, templateId));

  return c.json({ success: true });
});

export default cards;
