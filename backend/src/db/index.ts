import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.ts";

const connectionString = Deno.env.get("DATABASE_URL") || "mysql://tierlist:tierlistpassword@localhost:3306/tierlist";

const pool = mysql.createPool({
  uri: connectionString,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(pool, { schema, mode: "default" });

export { schema };
