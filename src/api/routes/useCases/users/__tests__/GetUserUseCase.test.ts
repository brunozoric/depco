import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UserService } from "#api/services/Auth/index.js";
import { GetUserUseCase } from "../abstractions/GetUserUseCase.js";

describe("GetUserUseCase", () => {
    it("returns the user when it exists", async () => {
        const { container } = createTestApiContainer();
        const userService = container.resolve(UserService);
        const useCase = container.resolve(GetUserUseCase);

        const created = await userService.create({
            email: "someone@example.com",
            displayName: "Someone",
            password: "password123",
            permission: "full"
        });

        const result = await useCase.execute({ id: created.id });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value).toEqual(created);
    });

    it("fails with 404 when the user does not exist", async () => {
        const { container } = createTestApiContainer();
        const useCase = container.resolve(GetUserUseCase);

        const result = await useCase.execute({ id: "missing-user" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(404);
    });
});
