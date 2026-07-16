import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { appSettings } from "../schema.js";
import { seedAppSettings } from "../seedAppSettings.js";

describe("seedAppSettings", () => {
    it("seeds all default settings when table is empty", async () => {
        const db = await createTestDb();

        await seedAppSettings(db);

        const rows = await db.select().from(appSettings).all();

        expect(rows).toHaveLength(5);

        const branchRow = rows.find(r => r.key === "branch_template");
        expect(branchRow).toBeDefined();
        expect(branchRow!.value).toBe("chore/update-dependencies-${YYYY}-${MM}-${DD}");

        const commitRow = rows.find(r => r.key === "commit_template");
        expect(commitRow).toBeDefined();
        expect(commitRow!.value).toBe("chore: update dependencies ${YYYY}-${MM}-${DD}");

        const logRow = rows.find(r => r.key === "log_level");
        expect(logRow).toBeDefined();
        expect(logRow!.value).toBe("warn");

        const snoozeCheckIntervalRow = rows.find(r => r.key === "snooze_check_interval");
        expect(snoozeCheckIntervalRow).toBeDefined();
        expect(snoozeCheckIntervalRow!.value).toBe("3600000");

        const transitiveResolveTtlRow = rows.find(r => r.key === "transitive-resolve-ttl");
        expect(transitiveResolveTtlRow).toBeDefined();
        expect(transitiveResolveTtlRow!.value).toBe("24");
    });

    it("does not overwrite existing settings", async () => {
        const db = await createTestDb();

        await db
            .insert(appSettings)
            .values({ key: "branch_template", value: "custom/my-branch" })
            .run();

        await seedAppSettings(db);

        const row = await db
            .select()
            .from(appSettings)
            .where(eq(appSettings.key, "branch_template"))
            .get();

        expect(row).toBeDefined();
        expect(row!.value).toBe("custom/my-branch");

        const allRows = await db.select().from(appSettings).all();
        expect(allRows).toHaveLength(5);
    });

    it("is idempotent — second call does not duplicate rows", async () => {
        const db = await createTestDb();

        await seedAppSettings(db);
        await seedAppSettings(db);

        const allRows = await db.select().from(appSettings).all();
        expect(allRows).toHaveLength(5);
    });
});
