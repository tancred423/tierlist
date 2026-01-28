import { Hono } from "@hono/hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId } from "../utils/id.ts";
import { requireAuth } from "../middleware/auth.ts";
import sharp from "sharp";

const uploads = new Hono();

const UPLOADS_DIR = Deno.env.get("UPLOADS_DIR") || "/app/uploads";
const MAX_UPLOAD_SIZE = parseInt(Deno.env.get("UPLOAD_MAX_SIZE_MB") || "10") * 1024 * 1024;
const MAX_OUTPUT_SIZE = parseInt(Deno.env.get("UPLOAD_MAX_OUTPUT_KB") || "100") * 1024;
const MAX_DIMENSION = parseInt(Deno.env.get("UPLOAD_MAX_DIMENSION") || "200");
const GLOBAL_STORAGE_LIMIT = parseInt(Deno.env.get("UPLOAD_STORAGE_LIMIT_GB") || "5") * 1024 * 1024 * 1024;

const IMAGE_MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xFF, 0xD8, 0xFF]],
  "image/png": [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

function isValidImageMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  for (const signatures of Object.values(IMAGE_MAGIC_BYTES)) {
    for (const signature of signatures) {
      if (signature.every((byte, i) => bytes[i] === byte)) {
        return true;
      }
    }
  }
  return false;
}

async function ensureDir(path: string) {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (err) {
    if (!(err instanceof Deno.errors.AlreadyExists)) {
      throw err;
    }
  }
}

async function getDirectorySize(path: string): Promise<number> {
  let totalSize = 0;
  try {
    for await (const entry of Deno.readDir(path)) {
      const entryPath = `${path}/${entry.name}`;
      if (entry.isDirectory) {
        totalSize += await getDirectorySize(entryPath);
      } else if (entry.isFile) {
        const stat = await Deno.stat(entryPath);
        totalSize += stat.size;
      }
    }
  } catch {
    // ignore
  }
  return totalSize;
}

async function deleteFile(path: string) {
  try {
    await Deno.remove(path);
  } catch {
    // ignore
  }
}

async function deleteDirectory(path: string) {
  try {
    await Deno.remove(path, { recursive: true });
  } catch {
    // ignore
  }
}

export async function deleteCardImage(imageUrl: string | null) {
  if (!imageUrl) return;

  if (imageUrl.startsWith("/uploads/")) {
    const filePath = `${UPLOADS_DIR}${imageUrl.replace("/uploads", "")}`;
    await deleteFile(filePath);
  }
}

export async function deleteTemplateImages(templateId: string) {
  const templateDir = `${UPLOADS_DIR}/${templateId}`;
  await deleteDirectory(templateDir);
}

export async function deleteUserImages(userId: string) {
  const templates = await db.query.templates.findMany({
    where: eq(schema.templates.ownerId, userId),
    columns: { id: true },
  });

  for (const template of templates) {
    await deleteTemplateImages(template.id);
  }
}

uploads.get("/storage", requireAuth, async (c) => {
  const totalSize = await getDirectorySize(UPLOADS_DIR);
  const usedGB = totalSize / (1024 * 1024 * 1024);
  const limitGB = GLOBAL_STORAGE_LIMIT / (1024 * 1024 * 1024);

  return c.json({
    used: totalSize,
    limit: GLOBAL_STORAGE_LIMIT,
    usedGB: Math.round(usedGB * 100) / 100,
    limitGB,
    available: totalSize < GLOBAL_STORAGE_LIMIT,
  });
});

uploads.post("/:templateId", requireAuth, async (c) => {
  const templateId = c.req.param("templateId");
  const user = c.get("user")!;

  const template = await db.query.templates.findFirst({
    where: eq(schema.templates.id, templateId),
  });

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  if (template.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const totalSize = await getDirectorySize(UPLOADS_DIR);
  if (totalSize >= GLOBAL_STORAGE_LIMIT) {
    return c.json({
      error: "Storage limit reached. Please use a URL to add an image instead.",
      code: "STORAGE_FULL",
    }, 507);
  }

  const contentType = c.req.header("content-type") || "";

  let imageBuffer: ArrayBuffer;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No image file provided" }, 400);
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return c.json({ error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` }, 400);
    }

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
    if (!validTypes.includes(file.type)) {
      return c.json({ error: "Invalid file type. Supported: JPEG, PNG, GIF, WebP, AVIF" }, 400);
    }

    imageBuffer = await file.arrayBuffer();
  } else if (contentType.includes("application/octet-stream") || contentType.includes("image/")) {
    const body = await c.req.arrayBuffer();

    if (body.byteLength > MAX_UPLOAD_SIZE) {
      return c.json({ error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` }, 400);
    }

    imageBuffer = body;
  } else {
    return c.json({ error: "Unsupported content type" }, 400);
  }

  if (!isValidImageMagicBytes(imageBuffer)) {
    return c.json({ error: "Invalid image file. Only JPEG, PNG, GIF, and WebP are supported." }, 400);
  }

  try {
    const processedImage = await sharp(imageBuffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 85,
        effort: 6,
      })
      .toBuffer();

    let finalBuffer = processedImage;

    if (processedImage.length > MAX_OUTPUT_SIZE) {
      let quality = 80;
      while (quality >= 20 && finalBuffer.length > MAX_OUTPUT_SIZE) {
        finalBuffer = await sharp(imageBuffer)
          .resize(MAX_DIMENSION, MAX_DIMENSION, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({
            quality,
            effort: 6,
          })
          .toBuffer();
        quality -= 10;
      }

      if (finalBuffer.length > MAX_OUTPUT_SIZE) {
        let dimension = 150;
        while (dimension >= 50 && finalBuffer.length > MAX_OUTPUT_SIZE) {
          finalBuffer = await sharp(imageBuffer)
            .resize(dimension, dimension, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({
              quality: 60,
              effort: 6,
            })
            .toBuffer();
          dimension -= 25;
        }
      }
    }

    const templateDir = `${UPLOADS_DIR}/${templateId}`;
    await ensureDir(templateDir);

    const fileId = generateId();
    const fileName = `${fileId}.webp`;
    const filePath = `${templateDir}/${fileName}`;

    await Deno.writeFile(filePath, finalBuffer);

    const imageUrl = `/uploads/${templateId}/${fileName}`;

    return c.json({
      imageUrl,
      size: finalBuffer.length,
    }, 201);
  } catch (err) {
    console.error("Image processing error:", err);

    if (err instanceof Error) {
      if (err.message.includes("unsupported image format") || err.message.includes("Input buffer")) {
        return c.json({ error: "Invalid or corrupted image file" }, 400);
      }
      if (err.name === "PermissionDenied" || err.message.includes("Permission denied")) {
        return c.json({ error: "Server storage configuration error. Please contact the administrator." }, 500);
      }
    }

    return c.json({ error: "Failed to process image. Please try a different image." }, 500);
  }
});

export default uploads;
