import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import { authMiddleware } from "./middleware/auth.ts";
import authRoutes from "./routes/auth.ts";
import templatesRoutes from "./routes/templates.ts";
import cardsRoutes from "./routes/cards.ts";
import filledTierlistsRoutes from "./routes/filled-tierlists.ts";

const app = new Hono();

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

app.use("*", logger());

app.use("*", cors({
  origin: [FRONTEND_URL, "http://localhost:5173"],
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.use("*", authMiddleware);

app.get("/", (c) => {
  return c.json({ 
    name: "Tierlist API",
    version: "1.0.0",
    status: "running",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

app.route("/api/auth", authRoutes);
app.route("/api/templates", templatesRoutes);
app.route("/api/cards", cardsRoutes);
app.route("/api/filled-tierlists", filledTierlistsRoutes);

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(Deno.env.get("PORT") || "3000");

console.log(`🚀 Server starting on port ${port}`);

Deno.serve({ port }, app.fetch);
