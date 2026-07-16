import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/api/db/schema.ts",
    out: "./src/api/db/migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.DB_PATH ?? "./data/manager.db"
    }
});
