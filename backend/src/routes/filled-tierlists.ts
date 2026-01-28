import { Hono } from "@hono/hono";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId, generateToken } from "../utils/id.ts";
import { requireAuth } from "../middleware/auth.ts";

const filledTierlists = new Hono();

filledTierlists.get("/my", requireAuth, async (c) => {
  const user = c.get("user")!;

  const ownedLists = await db.query.filledTierlists.findMany({
    where: eq(schema.filledTierlists.ownerId, user.userId),
    with: {
      template: {
        with: {
          owner: { columns: { id: true, username: true, avatar: true } },
          tiers: true,
          columns: true,
          cards: true,
        },
      },
      placements: true,
    },
    orderBy: [desc(schema.filledTierlists.updatedAt)],
  });

  const coOwnedRelations = await db.query.filledTierlistCoOwners.findMany({
    where: eq(schema.filledTierlistCoOwners.userId, user.userId),
    with: {
      filledTierlist: {
        with: {
          template: {
            with: {
              owner: { columns: { id: true, username: true, avatar: true } },
              tiers: true,
              columns: true,
              cards: true,
            },
          },
          owner: {
            columns: { id: true, username: true, avatar: true },
          },
          placements: true,
        },
      },
    },
  });

  const sharedLists = coOwnedRelations.map((rel) => ({
    ...rel.filledTierlist,
    isShared: true,
  }));

  return c.json({
    owned: ownedLists,
    shared: sharedLists,
  });
});

filledTierlists.post("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, body.templateId),
    with: {
      tiers: { orderBy: [schema.tiers.orderIndex] },
      columns: { orderBy: [schema.columns.orderIndex] },
      cards: { orderBy: [schema.cards.orderIndex] },
    },
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (!template.isPublic && template.ownerId !== user.userId) {
    const sharedTemplate = await db.query.templates.findFirst({
      where: eq(schema.templates.shareToken, body.shareToken || ""),
    });
    if (!sharedTemplate || sharedTemplate.id !== template.id) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  const templateSnapshot: schema.TemplateSnapshot = {
    tiers: template.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      orderIndex: t.orderIndex,
    })),
    columns: template.columns.map((c) => ({
      id: c.id,
      name: c.name,
      orderIndex: c.orderIndex,
    })),
    cards: template.cards.map((c) => ({
      id: c.id,
      title: c.title,
      imageUrl: c.imageUrl,
      description: c.description,
      orderIndex: c.orderIndex,
    })),
    snapshotAt: new Date().toISOString(),
  };

  const filledId = generateId();
  const viewToken = generateToken();
  const editToken = generateToken();

  await db.insert(schema.filledTierlists).values({
    id: filledId,
    templateId: template.id,
    ownerId: user.userId,
    title: body.title || `${template.title} - My Ranking`,
    templateSnapshot,
    viewShareToken: viewToken,
    viewShareEnabled: false,
    editShareToken: editToken,
    editShareEnabled: false,
  });

  for (const card of template.cards) {
    await db.insert(schema.cardPlacements).values({
      id: generateId(),
      listId: filledId,
      cardId: card.id,
      tierId: null,
      columnId: null,
      orderIndex: card.orderIndex,
    });
  }

  const filledList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, filledId),
    with: {
      template: {
        with: {
          owner: { columns: { id: true, username: true, avatar: true } },
        },
      },
      placements: true,
    },
  });

  return c.json({ filledTierlist: filledList }, 201);
});

filledTierlists.get("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const filledList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, id),
    with: {
      template: {
        with: {
          owner: { columns: { id: true, username: true, avatar: true } },
          tiers: { orderBy: [schema.tiers.orderIndex] },
          columns: { orderBy: [schema.columns.orderIndex] },
          cards: { orderBy: [schema.cards.orderIndex] },
        },
      },
      owner: { columns: { id: true, username: true, avatar: true } },
      placements: true,
      coOwners: {
        with: {
          user: { columns: { id: true, username: true, avatar: true } },
        },
      },
    },
  });

  if (!filledList) {
    return c.json({ error: "Filled tierlist not found" }, 404);
  }

  const isOwner = filledList.ownerId === user.userId;
  const isCoOwner = filledList.coOwners.some((co) => co.userId === user.userId);

  if (!isOwner && !isCoOwner) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (filledList.templateSnapshot) {
    const result = {
      ...filledList,
      template: {
        ...filledList.template,
        tiers: filledList.templateSnapshot.tiers,
        columns: filledList.templateSnapshot.columns,
        cards: filledList.templateSnapshot.cards,
      },
    };
    return c.json({ filledTierlist: result, canEdit: true });
  }

  return c.json({ filledTierlist: filledList, canEdit: true });
});

filledTierlists.get("/view/:token", async (c) => {
  const token = c.req.param("token");

  const filledList = await db.query.filledTierlists.findFirst({
    where: and(
      eq(schema.filledTierlists.viewShareToken, token),
      eq(schema.filledTierlists.viewShareEnabled, true),
    ),
    with: {
      template: {
        with: {
          owner: { columns: { id: true, username: true, avatar: true } },
          tiers: { orderBy: [schema.tiers.orderIndex] },
          columns: { orderBy: [schema.columns.orderIndex] },
          cards: { orderBy: [schema.cards.orderIndex] },
        },
      },
      owner: { columns: { id: true, username: true, avatar: true } },
      placements: true,
    },
  });

  if (!filledList) {
    return c.json({ error: "Tierlist not found or sharing disabled" }, 404);
  }

  if (filledList.templateSnapshot) {
    const result = {
      ...filledList,
      template: {
        ...filledList.template,
        tiers: filledList.templateSnapshot.tiers,
        columns: filledList.templateSnapshot.columns,
        cards: filledList.templateSnapshot.cards,
      },
    };
    return c.json({ filledTierlist: result, canEdit: false });
  }

  return c.json({ filledTierlist: filledList, canEdit: false });
});

filledTierlists.get("/edit/:token", requireAuth, async (c) => {
  const token = c.req.param("token");
  const user = c.get("user")!;

  const filledList = await db.query.filledTierlists.findFirst({
    where: and(
      eq(schema.filledTierlists.editShareToken, token),
      eq(schema.filledTierlists.editShareEnabled, true),
    ),
    with: {
      template: {
        with: {
          owner: { columns: { id: true, username: true, avatar: true } },
          tiers: { orderBy: [schema.tiers.orderIndex] },
          columns: { orderBy: [schema.columns.orderIndex] },
          cards: { orderBy: [schema.cards.orderIndex] },
        },
      },
      owner: { columns: { id: true, username: true, avatar: true } },
      placements: true,
      coOwners: true,
    },
  });

  if (!filledList) {
    return c.json({ error: "Tierlist not found or edit sharing disabled" }, 404);
  }

  const isAlreadyCoOwner = filledList.coOwners.some((co) => co.userId === user.userId);
  const isOwner = filledList.ownerId === user.userId;

  if (!isAlreadyCoOwner && !isOwner) {
    await db.insert(schema.filledTierlistCoOwners).values({
      listId: filledList.id,
      userId: user.userId,
    });
  }

  if (filledList.templateSnapshot) {
    const result = {
      ...filledList,
      template: {
        ...filledList.template,
        tiers: filledList.templateSnapshot.tiers,
        columns: filledList.templateSnapshot.columns,
        cards: filledList.templateSnapshot.cards,
      },
    };
    return c.json({ filledTierlist: result, canEdit: true });
  }

  return c.json({ filledTierlist: filledList, canEdit: true });
});

filledTierlists.put("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json();

  const filledList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, id),
    with: {
      coOwners: true,
    },
  });

  if (!filledList) {
    return c.json({ error: "Filled tierlist not found" }, 404);
  }

  const isOwner = filledList.ownerId === user.userId;
  const isCoOwner = filledList.coOwners.some((co) => co.userId === user.userId);

  if (!isOwner && !isCoOwner) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (body.title !== undefined || body.viewShareEnabled !== undefined || body.editShareEnabled !== undefined) {
    if (!isOwner) {
      return c.json({ error: "Only owner can change settings" }, 403);
    }

    await db.update(schema.filledTierlists)
      .set({
        title: body.title ?? filledList.title,
        viewShareEnabled: body.viewShareEnabled ?? filledList.viewShareEnabled,
        editShareEnabled: body.editShareEnabled ?? filledList.editShareEnabled,
      })
      .where(eq(schema.filledTierlists.id, id));
  }

  return c.json({ success: true });
});

filledTierlists.put("/:id/placements", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json();

  const filledList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, id),
    with: {
      coOwners: true,
    },
  });

  if (!filledList) {
    return c.json({ error: "Filled tierlist not found" }, 404);
  }

  const isOwner = filledList.ownerId === user.userId;
  const isCoOwner = filledList.coOwners.some((co) => co.userId === user.userId);

  if (!isOwner && !isCoOwner) {
    return c.json({ error: "Access denied" }, 403);
  }

  const placements: Array<{
    cardId: string;
    tierId: string | null;
    columnId: string | null;
    orderIndex: number;
  }> = body.placements;

  await db.delete(schema.cardPlacements)
    .where(eq(schema.cardPlacements.listId, id));

  for (const placement of placements) {
    await db.insert(schema.cardPlacements).values({
      id: generateId(),
      listId: id,
      cardId: placement.cardId,
      tierId: placement.tierId,
      columnId: placement.columnId,
      orderIndex: placement.orderIndex,
    });
  }

  const updatedList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, id),
    with: {
      placements: true,
    },
  });

  return c.json({ placements: updatedList?.placements });
});

filledTierlists.post("/:id/regenerate-tokens", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json();

  const filledList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, id),
  });

  if (!filledList) {
    return c.json({ error: "Filled tierlist not found" }, 404);
  }

  if (filledList.ownerId !== user.userId) {
    return c.json({ error: "Only owner can regenerate tokens" }, 403);
  }

  const updates: Partial<typeof filledList> = {};

  if (body.regenerateView) {
    updates.viewShareToken = generateToken();
  }

  if (body.regenerateEdit) {
    updates.editShareToken = generateToken();
    await db.delete(schema.filledTierlistCoOwners)
      .where(eq(schema.filledTierlistCoOwners.listId, id));
  }

  if (Object.keys(updates).length > 0) {
    await db.update(schema.filledTierlists)
      .set(updates)
      .where(eq(schema.filledTierlists.id, id));
  }

  const updatedList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, id),
  });

  return c.json({
    viewShareToken: updatedList?.viewShareToken,
    editShareToken: updatedList?.editShareToken,
  });
});

filledTierlists.post("/:id/leave", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const coOwnerRecord = await db.query.filledTierlistCoOwners.findFirst({
    where: and(
      eq(schema.filledTierlistCoOwners.listId, id),
      eq(schema.filledTierlistCoOwners.userId, user.userId),
    ),
  });

  if (!coOwnerRecord) {
    return c.json({ error: "You are not a co-owner of this tierlist" }, 404);
  }

  await db.delete(schema.filledTierlistCoOwners)
    .where(and(
      eq(schema.filledTierlistCoOwners.listId, id),
      eq(schema.filledTierlistCoOwners.userId, user.userId),
    ));

  return c.json({ success: true });
});

filledTierlists.post("/:id/copy", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const sourceList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, id),
    with: {
      placements: true,
      template: true,
    },
  });

  if (!sourceList) {
    return c.json({ error: "Filled tierlist not found" }, 404);
  }

  const newId = generateId();
  const viewToken = generateToken();
  const editToken = generateToken();

  await db.insert(schema.filledTierlists).values({
    id: newId,
    templateId: sourceList.templateId,
    ownerId: user.userId,
    title: `${sourceList.title} (Copy)`,
    templateSnapshot: sourceList.templateSnapshot,
    viewShareToken: viewToken,
    viewShareEnabled: false,
    editShareToken: editToken,
    editShareEnabled: false,
  });

  for (const placement of sourceList.placements) {
    await db.insert(schema.cardPlacements).values({
      id: generateId(),
      listId: newId,
      cardId: placement.cardId,
      tierId: placement.tierId,
      columnId: placement.columnId,
      orderIndex: placement.orderIndex,
    });
  }

  const newList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, newId),
    with: {
      template: {
        with: {
          owner: { columns: { id: true, username: true, avatar: true } },
        },
      },
      placements: true,
    },
  });

  return c.json({ filledTierlist: newList }, 201);
});

filledTierlists.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const filledList = await db.query.filledTierlists.findFirst({
    where: eq(schema.filledTierlists.id, id),
  });

  if (!filledList) {
    return c.json({ error: "Filled tierlist not found" }, 404);
  }

  if (filledList.ownerId !== user.userId) {
    return c.json({ error: "Only owner can delete" }, 403);
  }

  await db.delete(schema.filledTierlists).where(eq(schema.filledTierlists.id, id));

  return c.json({ success: true });
});

export default filledTierlists;
