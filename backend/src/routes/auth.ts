import { Hono } from "@hono/hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { generateId } from "../utils/id.ts";
import { signJWT } from "../utils/jwt.ts";
import { getDiscordAuthUrl, exchangeCodeForToken, getDiscordUser } from "../services/discord.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

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

    return c.redirect(`${FRONTEND_URL}/auth/callback?token=${jwt}`);
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
      avatar: dbUser.avatar,
      discriminator: dbUser.discriminator,
      createdAt: dbUser.createdAt,
    },
  });
});

auth.delete("/me", async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  await db.delete(schema.users).where(eq(schema.users.id, user.userId));

  return c.json({ success: true });
});

export default auth;
