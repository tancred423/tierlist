import { Context, Next } from "@hono/hono";
import { getCookie } from "@hono/hono/cookie";
import { verifyJWT } from "../utils/jwt.ts";

export interface AuthUser {
  userId: string;
  discordId: string;
  username: string;
}

declare module "@hono/hono" {
  interface ContextVariableMap {
    user: AuthUser | null;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const token = getCookie(c, "auth_token");

  if (!token) {
    c.set("user", null);
    return next();
  }

  const payload = await verifyJWT(token);

  if (!payload) {
    c.set("user", null);
    return next();
  }

  c.set("user", {
    userId: payload.userId,
    discordId: payload.discordId,
    username: payload.username,
  });

  return next();
}

export function requireAuth(c: Context, next: Next) {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  return next();
}
