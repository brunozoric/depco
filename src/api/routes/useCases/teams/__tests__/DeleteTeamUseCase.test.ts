import { describe, it, expect, beforeEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { teams } from "#api/db/schema.js";
import { DeleteTeamUseCase } from "../abstractions/DeleteTeamUseCase.js";

describe("DeleteTeamUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: DeleteTeamUseCase.Interface;

    beforeEach(async () => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(DeleteTeamUseCase);

        await db
            .insert(teams)
            .values({ id: "team-1", name: "Platform", color: "#ff0000", createdAt: Date.now() })
            .run();
    });

    it("deletes an existing team", async () => {
        const result = await useCase.execute({ id: "team-1" });

        expect(result.isOk()).toBe(true);

        const rows = await db.select().from(teams).all();
        expect(rows).toHaveLength(0);
    });

    it("fails with 404 when the team does not exist", async () => {
        const result = await useCase.execute({ id: "missing-team" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(404);
    });
});
