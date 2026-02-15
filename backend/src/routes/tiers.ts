import { Hono } from "@hono/hono";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId } from "../utils/id.ts";
import { requireAuth } from "../middleware/auth.ts";
import { LIMITS, validateOptionalString } from "../utils/validation.ts";
import { verifyTemplateOwner } from "../utils/template.ts";

const tiersRouter = new Hono();

tiersRouter.post("/:templateId", requireAuth, async (c) => {
  const templateId = c.req.param("templateId");
  const user = c.get("user")!;
  const body = await c.req.json();

  const check = await verifyTemplateOwner(templateId, user.userId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  const existing = await db.query.tiers.findMany({
    where: eq(schema.tiers.templateId, templateId),
  });
  if (existing.length >= LIMITS.MAX_TIERS) {
    return c.json({ error: `Maximum ${LIMITS.MAX_TIERS} tiers allowed` }, 400);
  }

  const nameResult = validateOptionalString(body.name, LIMITS.TIER_NAME, "Name");
  if (!nameResult.valid) return c.json({ error: nameResult.error }, 400);

  const id = generateId();
  const orderIndex = body.orderIndex ?? existing.length;
  const name = nameResult.value || `Tier ${existing.length + 1}`;
  const color = body.color || "#888888";

  await db.insert(schema.tiers).values({
    id,
    templateId,
    name,
    color,
    orderIndex,
  });

  const tier = await db.query.tiers.findFirst({ where: eq(schema.tiers.id, id) });
  return c.json({ tier }, 201);
});

tiersRouter.put("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json();

  const tier = await db.query.tiers.findFirst({ where: eq(schema.tiers.id, id) });
  if (!tier) return c.json({ error: "Tier not found" }, 404);

  const check = await verifyTemplateOwner(tier.templateId, user.userId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const nameResult = validateOptionalString(body.name, LIMITS.TIER_NAME, "Name");
    if (!nameResult.valid) return c.json({ error: nameResult.error }, 400);
    if (nameResult.value) updates.name = nameResult.value;
  }

  if (body.color !== undefined) {
    if (typeof body.color === "string" && (body.color === "" || /^#[0-9a-fA-F]{6}$/.test(body.color))) {
      updates.color = body.color;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(schema.tiers).set(updates).where(eq(schema.tiers.id, id));
  }

  const updated = await db.query.tiers.findFirst({ where: eq(schema.tiers.id, id) });
  return c.json({ tier: updated });
});

tiersRouter.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const tier = await db.query.tiers.findFirst({ where: eq(schema.tiers.id, id) });
  if (!tier) return c.json({ error: "Tier not found" }, 404);

  const check = await verifyTemplateOwner(tier.templateId, user.userId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  const count = await db.query.tiers.findMany({
    where: eq(schema.tiers.templateId, tier.templateId),
  });
  if (count.length <= 1) {
    return c.json({ error: "Cannot delete the last tier" }, 400);
  }

  await db.delete(schema.tiers).where(eq(schema.tiers.id, id));
  return c.json({ success: true });
});

tiersRouter.put("/:templateId/reorder", requireAuth, async (c) => {
  const templateId = c.req.param("templateId");
  const user = c.get("user")!;
  const body = await c.req.json();

  const check = await verifyTemplateOwner(templateId, user.userId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  const tierOrders: { id: string; orderIndex: number }[] = body.tierOrders;
  if (!Array.isArray(tierOrders)) {
    return c.json({ error: "tierOrders must be an array" }, 400);
  }

  for (const item of tierOrders) {
    await db.update(schema.tiers)
      .set({ orderIndex: item.orderIndex })
      .where(and(eq(schema.tiers.id, item.id), eq(schema.tiers.templateId, templateId)));
  }

  return c.json({ success: true });
});

export default tiersRouter;
