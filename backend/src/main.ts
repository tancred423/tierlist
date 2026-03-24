import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import { serveStatic } from "@hono/hono/deno";
import { authMiddleware } from "./middleware/auth.ts";
import authRoutes from "./routes/auth.ts";
import templatesRoutes from "./routes/templates.ts";
import cardsRoutes from "./routes/cards.ts";
import filledTierlistsRoutes from "./routes/filled-tierlists.ts";
import uploadsRoutes from "./routes/uploads.ts";
import tiersRoutes from "./routes/tiers.ts";
import columnsRoutes from "./routes/columns.ts";

const app = new Hono();

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
const UPLOADS_DIR = Deno.env.get("UPLOADS_DIR") || "/app/uploads";

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173"],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use("/uploads/*", serveStatic({ root: UPLOADS_DIR, rewriteRequestPath: (path) => path.replace("/uploads", "") }));
app.use(
  "/api/uploads/*",
  serveStatic({ root: UPLOADS_DIR, rewriteRequestPath: (path) => path.replace("/api/uploads", "") }),
);

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

app.route("/auth", authRoutes);
app.route("/templates", templatesRoutes);
app.route("/cards", cardsRoutes);
app.route("/filled-tierlists", filledTierlistsRoutes);
app.route("/uploads", uploadsRoutes);
app.route("/tiers", tiersRoutes);
app.route("/columns", columnsRoutes);

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
