import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { pmSecuritySettings } from "../schema.js";
import { seedSecurityDefaults } from "../seedSecurityDefaults.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";

describe("seedSecurityDefaults", () => {
    it("seeds all package managers when table is empty", async () => {
        const db = await createTestDb();

        await seedSecurityDefaults(db);

        for (const [pm, fields] of Object.entries(SECURITY_FIELD_REGISTRY)) {
            const rows = await db
                .select()
                .from(pmSecuritySettings)
                .where(eq(pmSecuritySettings.packageManager, pm))
                .all();

            expect(rows).toHaveLength(fields.length);

            for (const field of fields) {
                const row = rows.find(r => r.fieldName === field.fieldName);
                expect(row).toBeDefined();
                expect(row!.configFile).toBe(field.configFile);
                expect(row!.expectedValue).toBe(field.defaultExpectedValue);
            }
        }
    });

    it("skips a package manager that already has rows", async () => {
        const db = await createTestDb();
        const { seedYarnSecuritySettings } =
            await import("#testing/helpers/seedYarnSecuritySettings.js");
        await seedYarnSecuritySettings(db);

        await seedSecurityDefaults(db);

        const yarnRows = await db
            .select()
            .from(pmSecuritySettings)
            .where(eq(pmSecuritySettings.packageManager, "yarn"))
            .all();

        expect(yarnRows).toHaveLength(SECURITY_FIELD_REGISTRY.yarn.length);
        expect(yarnRows[0]!.expectedValue).toBe("exists");

        const npmRows = await db
            .select()
            .from(pmSecuritySettings)
            .where(eq(pmSecuritySettings.packageManager, "npm"))
            .all();
        expect(npmRows).toHaveLength(SECURITY_FIELD_REGISTRY.npm.length);
    });

    it("is idempotent — second call does not duplicate rows", async () => {
        const db = await createTestDb();

        await seedSecurityDefaults(db);
        await seedSecurityDefaults(db);

        const allRows = await db.select().from(pmSecuritySettings).all();

        const expectedTotal = Object.values(SECURITY_FIELD_REGISTRY).reduce(
            (sum, fields) => sum + fields.length,
            0
        );
        expect(allRows).toHaveLength(expectedTotal);
    });
});
