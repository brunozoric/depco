import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UserService } from "#api/services/Auth/index.js";
import { GetMeUseCase } from "../abstractions/GetMeUseCase.js";

describe("GetMeUseCase", () => {
    it("returns the current user when the session user exists", async () => {
        const { container } = createTestApiContainer();
        const userService = container.resolve(UserService);
        const useCase = container.resolve(GetMeUseCase);

        const user = await userService.create({
            email: "me@example.com",
            displayName: "Me",
            password: "password123",
            permission: "full"
        });

        const result = await useCase.execute({ userId: user.id });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value).toEqual(user);
    });

    it("fails with 401 when the session user no longer exists", async () => {
        const { container } = createTestApiContainer();
        const useCase = container.resolve(GetMeUseCase);

        const result = await useCase.execute({ userId: "missing-user" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(401);
        expect(result.error.message).toBe("Session expired");
    });
});
