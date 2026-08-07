import { existsSync, mkdirSync } from "fs";
import { input, password } from "@inquirer/prompts";
import { hash } from "argon2";
import { generateId } from "@webiny/stdlib";
import { sql } from "drizzle-orm";
import { createDatabaseClient } from "#api/db/client.js";
import { runMigrations } from "#api/db/migrate.js";
import { users } from "#api/db/schema.js";

const DATA_DIR = "./data";
const DB_PATH = process.env["DB_PATH"] ?? "./data/manager.db";

export async function init(): Promise<void> {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }

    const databaseClient = createDatabaseClient(DB_PATH);
    runMigrations(databaseClient.db);

    const countResult = databaseClient.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .get();

    if (countResult && countResult.count > 0) {
        console.log("Users already exist. Use the app to manage users.");
        process.exit(0);
    }

    console.log("Create the first admin user:\n");

    const email = await input({
        message: "Email:",
        validate: value => {
            if (!value.includes("@")) {
                return "Please enter a valid email address";
            }
            return true;
        }
    });

    const displayName = await input({
        message: "Display name:",
        validate: value => {
            if (value.length < 1) {
                return "Display name is required";
            }
            return true;
        }
    });

    const userPassword = await password({
        message: "Password (min 8 chars):",
        validate: value => {
            if (value.length < 8) {
                return "Password must be at least 8 characters";
            }
            return true;
        }
    });

    const confirmPassword = await password({
        message: "Confirm password:"
    });

    if (userPassword !== confirmPassword) {
        console.error("Passwords do not match.");
        process.exit(1);
    }

    const passwordHash = await hash(userPassword);
    const now = Date.now();

    databaseClient.db
        .insert(users)
        .values({
            id: generateId(),
            email: email.toLowerCase().trim(),
            passwordHash,
            displayName,
            permission: "full",
            isActive: 1,
            createdAt: now,
            updatedAt: now
        })
        .run();

    console.log(`\nAdmin user created: ${email}`);
    console.log("Start the server with 'yarn dev' and login.");
}
