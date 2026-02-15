import { Hono } from "@hono/hono";
import { deleteCookie, setCookie } from "@hono/hono/cookie";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId } from "../utils/id.ts";
import { signJWT } from "../utils/jwt.ts";
import { exchangeCodeForToken, getDiscordAuthUrl, getDiscordUser } from "../services/discord.ts";
import { requireAuth } from "../middleware/auth.ts";
import { deleteUserImages } from "./uploads.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
const IS_PRODUCTION = Deno.env.get("NODE_ENV") === "production";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

const auth = new Hono();

const pendingStates = new Map<string, { timestamp: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      pendingStates.delete(state);
    }
  }
}, 60 * 1000);

auth.get("/discord", (c) => {
  const state = crypto.randomUUID();
  pendingStates.set(state, { timestamp: Date.now() });
  const authUrl = getDiscordAuthUrl(state);
  return c.json({ url: authUrl });
});

auth.get("/discord/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.redirect(`${FRONTEND_URL}/?error=${error}`);
  }

  if (!code || !state) {
    return c.redirect(`${FRONTEND_URL}/?error=missing_params`);
  }

  if (!pendingStates.has(state)) {
    return c.redirect(`${FRONTEND_URL}/?error=invalid_state`);
  }
  pendingStates.delete(state);

  try {
    const tokenData = await exchangeCodeForToken(code);
    const discordUser = await getDiscordUser(tokenData.access_token);

    let user = await db.query.users.findFirst({
      where: eq(schema.users.discordId, discordUser.id),
    });

    if (!user) {
      const userId = generateId();
      await db.insert(schema.users).values({
        id: userId,
        discordId: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
        email: discordUser.email || null,
      });
      user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });
    } else {
      await db.update(schema.users)
        .set({
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar,
          email: discordUser.email || user.email,
        })
        .where(eq(schema.users.discordId, discordUser.id));
    }

    if (!user) {
      return c.redirect(`${FRONTEND_URL}/?error=user_creation_failed`);
    }

    const jwt = await signJWT({
      userId: user.id,
      discordId: user.discordId,
      username: user.username,
    });

    setCookie(c, "auth_token", jwt, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "Strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return c.redirect(`${FRONTEND_URL}/auth/callback`);
  } catch (err) {
    console.error("Discord auth error:", err);
    return c.redirect(`${FRONTEND_URL}/?error=auth_failed`);
  }
});

auth.get("/me", async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ user: null });
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.userId),
  });

  if (!dbUser) {
    return c.json({ user: null });
  }

  return c.json({
    user: {
      id: dbUser.id,
      discordId: dbUser.discordId,
      username: dbUser.username,
      nickname: dbUser.nickname,
      avatar: dbUser.avatar,
      discriminator: dbUser.discriminator,
      tierlistSort: dbUser.tierlistSort || "updated_desc",
      templateSort: dbUser.templateSort || "updated_desc",
      createdAt: dbUser.createdAt,
    },
  });
});

const VALID_SORT_OPTIONS = ["updated_desc", "created_desc", "created_asc", "title_asc", "title_desc"];

auth.put("/me", requireAuth, async (c) => {
  const user = c.get("user")!;

  const body = await c.req.json();
  const { nickname, tierlistSort, templateSort } = body;

  const updates: Record<string, unknown> = {};

  if (nickname !== undefined && nickname !== null) {
    const trimmed = typeof nickname === "string" ? nickname.trim() : "";
    if (trimmed.length > 255) {
      return c.json({ error: "Nickname must be at most 255 characters" }, 400);
    }
    updates.nickname = trimmed || null;
  }

  if (tierlistSort !== undefined) {
    if (!VALID_SORT_OPTIONS.includes(tierlistSort)) {
      return c.json({ error: "Invalid tierlistSort value" }, 400);
    }
    updates.tierlistSort = tierlistSort;
  }

  if (templateSort !== undefined) {
    if (!VALID_SORT_OPTIONS.includes(templateSort)) {
      return c.json({ error: "Invalid templateSort value" }, 400);
    }
    updates.templateSort = templateSort;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, user.userId));
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.userId),
  });

  if (!dbUser) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: {
      id: dbUser.id,
      discordId: dbUser.discordId,
      username: dbUser.username,
      nickname: dbUser.nickname,
      avatar: dbUser.avatar,
      discriminator: dbUser.discriminator,
      tierlistSort: dbUser.tierlistSort || "updated_desc",
      templateSort: dbUser.templateSort || "updated_desc",
      createdAt: dbUser.createdAt,
    },
  });
});

auth.delete("/me", requireAuth, async (c) => {
  const user = c.get("user")!;

  await deleteUserImages(user.userId);

  await db.delete(schema.users).where(eq(schema.users.id, user.userId));

  deleteCookie(c, "auth_token", {
    path: "/",
  });

  return c.json({ success: true });
});

auth.post("/logout", (c) => {
  deleteCookie(c, "auth_token", {
    path: "/",
  });

  return c.json({ success: true });
});

export default auth;
