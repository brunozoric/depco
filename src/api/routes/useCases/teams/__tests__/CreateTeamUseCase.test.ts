import { describe, it, expect, beforeEach } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { CreateTeamUseCase } from "../abstractions/CreateTeamUseCase.js";

describe("CreateTeamUseCase", () => {
    let useCase: CreateTeamUseCase.Interface;

    beforeEach(() => {
        const { container } = createTestApiContainer();
        useCase = container.resolve(CreateTeamUseCase);
    });

    it("creates a team with zeroed stats", async () => {
        const result = await useCase.execute({ name: "Platform", color: "#ff0000" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value).toEqual({
            id: expect.any(String),
            name: "Platform",
            color: "#ff0000",
            createdAt: expect.any(Number),
            projectCount: 0,
            vulnerabilityCount: 0,
            compliantPercent: 100,
            averageHealthScore: 0
        });
    });

    it("fails with 409 when a team with the same name already exists", async () => {
        await useCase.execute({ name: "Platform", color: "#ff0000" });

        const result = await useCase.execute({ name: "Platform", color: "#00ff00" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.code).toBe("TEAM_NAME_CONFLICT");
        expect(result.error.statusCode).toBe(409);
        expect(result.error.message).toContain("Platform");
    });
});
