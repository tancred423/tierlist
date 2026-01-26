import { defineConfig } from "drizzle-kit";

const getDatabaseUrl = () => {
  if (typeof Deno !== "undefined") {
    return Deno.env.get("DATABASE_URL");
  }
  return process.env.DATABASE_URL;
};

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: getDatabaseUrl() || "mysql://tierlist:tierlistpassword@localhost:3306/tierlist",
  },
});
