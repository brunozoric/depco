import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { UpgradeSessionsUseCasesFeature } from "../feature.js";
import { AbortUpgradeSessionUseCase } from "../abstractions/AbortUpgradeSessionUseCase.js";

interface ICreateContextOptions {
    upgradeSessionService?: Partial<UpgradeSessionService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: AbortUpgradeSessionUseCase.Interface;
}

function createUpgradeSessionServiceStub(
    overrides?: Partial<UpgradeSessionService.Interface>
): UpgradeSessionService.Interface {
    return {
        createSession: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getSession: vi.fn(async () => null),
        executeStep: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        skipStep: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        abortSession: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    UpgradeSessionsUseCasesFeature.register(container);
    container.registerInstance(
        UpgradeSessionService,
        createUpgradeSessionServiceStub(options.upgradeSessionService)
    );

    return { container, useCase: container.resolve(AbortUpgradeSessionUseCase) };
}

function createSessionFixture(): UpgradeSessionService.Row {
    return {
        id: "session-1",
        projectId: "project-1",
        status: "aborted",
        currentStep: "branch",
        steps: [],
        stepOrder: [
            "select-packages",
            "branch",
            "upgrade",
            "refresh-transient",
            "commit",
            "push",
            "create-pr"
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

describe("AbortUpgradeSessionUseCase", () => {
    it("aborts the session and returns it", async () => {
        const fixture = createSessionFixture();
        const abortSession = vi.fn(async () => fixture);
        const { useCase } = createContext({ upgradeSessionService: { abortSession } });

        const result = await useCase.execute({ projectId: "project-1", sessionId: "session-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(abortSession).toHaveBeenCalledWith("session-1", "project-1");
    });

    it("fails with 409 when the session is already inactive", async () => {
        const abortSession = vi.fn(async () => {
            throw new Error("Session is not active");
        });
        const { useCase } = createContext({ upgradeSessionService: { abortSession } });

        const result = await useCase.execute({ projectId: "project-1", sessionId: "session-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 409,
            message: "Session is not active"
        });
    });

    it("fails with 404 when the session does not exist", async () => {
        const abortSession = vi.fn(async () => {
            throw new Error("Session not found");
        });
        const { useCase } = createContext({ upgradeSessionService: { abortSession } });

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "missing-session"
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 404,
            message: "Session not found"
        });
    });

    it("fails with 500 when the service throws an unexpected error", async () => {
        const abortSession = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ upgradeSessionService: { abortSession } });

        const result = await useCase.execute({ projectId: "project-1", sessionId: "session-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "db unavailable"
        });
    });
});
