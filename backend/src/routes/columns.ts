import { Hono } from "@hono/hono";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId } from "../utils/id.ts";
import { requireAuth } from "../middleware/auth.ts";
import { LIMITS, validateOptionalString } from "../utils/validation.ts";
import { verifyTemplateOwner } from "../utils/template.ts";

const columnsRouter = new Hono();

columnsRouter.post("/:templateId", requireAuth, async (c) => {
  const templateId = c.req.param("templateId");
  const user = c.get("user")!;
  const body = await c.req.json();

  const check = await verifyTemplateOwner(templateId, user.userId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  const existing = await db.query.columns.findMany({
    where: eq(schema.columns.templateId, templateId),
  });
  if (existing.length >= LIMITS.MAX_COLUMNS) {
    return c.json({ error: `Maximum ${LIMITS.MAX_COLUMNS} columns allowed` }, 400);
  }

  const nameResult = validateOptionalString(body.name, LIMITS.COLUMN_NAME, "Name");
  if (!nameResult.valid) return c.json({ error: nameResult.error }, 400);

  const id = generateId();
  const orderIndex = body.orderIndex ?? existing.length;

  await db.insert(schema.columns).values({
    id,
    templateId,
    name: nameResult.value,
    color: body.color || null,
    orderIndex,
  });

  const column = await db.query.columns.findFirst({ where: eq(schema.columns.id, id) });
  return c.json({ column }, 201);
});

columnsRouter.put("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json();

  const col = await db.query.columns.findFirst({ where: eq(schema.columns.id, id) });
  if (!col) return c.json({ error: "Column not found" }, 404);

  const check = await verifyTemplateOwner(col.templateId, user.userId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const nameResult = validateOptionalString(body.name, LIMITS.COLUMN_NAME, "Name");
    if (!nameResult.valid) return c.json({ error: nameResult.error }, 400);
    updates.name = nameResult.value;
  }
  if (body.color !== undefined) {
    updates.color = body.color || null;
  }
  if (Object.keys(updates).length > 0) {
    await db.update(schema.columns).set(updates).where(eq(schema.columns.id, id));
  }

  const updated = await db.query.columns.findFirst({ where: eq(schema.columns.id, id) });
  return c.json({ column: updated });
});

columnsRouter.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const col = await db.query.columns.findFirst({ where: eq(schema.columns.id, id) });
  if (!col) return c.json({ error: "Column not found" }, 404);

  const check = await verifyTemplateOwner(col.templateId, user.userId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  const count = await db.query.columns.findMany({
    where: eq(schema.columns.templateId, col.templateId),
  });
  if (count.length <= 1) {
    return c.json({ error: "Cannot delete the last column" }, 400);
  }

  await db.delete(schema.columns).where(eq(schema.columns.id, id));
  return c.json({ success: true });
});

columnsRouter.put("/:templateId/reorder", requireAuth, async (c) => {
  const templateId = c.req.param("templateId");
  const user = c.get("user")!;
  const body = await c.req.json();

  const check = await verifyTemplateOwner(templateId, user.userId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  const columnOrders: { id: string; orderIndex: number }[] = body.columnOrders;
  if (!Array.isArray(columnOrders)) {
    return c.json({ error: "columnOrders must be an array" }, 400);
  }

  for (const item of columnOrders) {
    await db.update(schema.columns)
      .set({ orderIndex: item.orderIndex })
      .where(and(eq(schema.columns.id, item.id), eq(schema.columns.templateId, templateId)));
  }

  return c.json({ success: true });
});

export default columnsRouter;
