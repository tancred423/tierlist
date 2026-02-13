import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";

export async function verifyTemplateOwner(templateId: string, userId: string) {
  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, templateId),
  });
  if (!template) return { error: "Template not found", status: 404 as const };
  if (template.ownerId !== userId) return { error: "Access denied", status: 403 as const };
  return { template };
}
