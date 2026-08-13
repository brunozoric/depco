import { describe, it, expect, beforeEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { teams } from "#api/db/schema.js";
import { UpdateTeamUseCase } from "../abstractions/UpdateTeamUseCase.js";

describe("UpdateTeamUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: UpdateTeamUseCase.Interface;

    beforeEach(async () => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(UpdateTeamUseCase);

        await db
            .insert(teams)
            .values([
                { id: "team-1", name: "Platform", color: "#ff0000", createdAt: Date.now() },
                { id: "team-2", name: "Growth", color: "#00ff00", createdAt: Date.now() }
            ])
            .run();
    });

    it("updates the name and color", async () => {
        const result = await useCase.execute({
            id: "team-1",
            name: "Core Platform",
            color: "#0000ff"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.name).toBe("Core Platform");
        expect(result.value.color).toBe("#0000ff");
    });

    it("leaves unspecified fields unchanged", async () => {
        const result = await useCase.execute({ id: "team-1", color: "#0000ff" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.name).toBe("Platform");
        expect(result.value.color).toBe("#0000ff");
    });

    it("fails with 404 when the team does not exist", async () => {
        const result = await useCase.execute({ id: "missing-team", name: "New Name" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(404);
    });

    it("fails with 409 when renaming to an existing team's name", async () => {
        const result = await useCase.execute({ id: "team-1", name: "Growth" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(409);
    });

    it("allows keeping the same name without triggering a conflict", async () => {
        const result = await useCase.execute({ id: "team-1", name: "Platform", color: "#123456" });

        expect(result.isOk()).toBe(true);
    });
});
