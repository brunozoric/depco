import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { UpgradeSessionsUseCasesFeature } from "../feature.js";
import { SkipUpgradeStepUseCase } from "../abstractions/SkipUpgradeStepUseCase.js";

interface ICreateContextOptions {
    upgradeSessionService?: Partial<UpgradeSessionService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: SkipUpgradeStepUseCase.Interface;
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

    return { container, useCase: container.resolve(SkipUpgradeStepUseCase) };
}

function createSessionFixture(): UpgradeSessionService.Row {
    return {
        id: "session-1",
        projectId: "project-1",
        status: "active",
        currentStep: "refresh-transient",
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

describe("SkipUpgradeStepUseCase", () => {
    it("skips the step and returns the updated session", async () => {
        const fixture = createSessionFixture();
        const skipStep = vi.fn(async () => fixture);
        const { useCase } = createContext({ upgradeSessionService: { skipStep } });

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "session-1",
            stepType: "refresh-transient"
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(skipStep).toHaveBeenCalledWith("session-1", "project-1", "refresh-transient");
    });

    it("fails with 400 when the required step cannot be skipped", async () => {
        const skipStep = vi.fn(async () => {
            throw new Error("select-packages is required and cannot be skipped");
        });
        const { useCase } = createContext({ upgradeSessionService: { skipStep } });

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "session-1",
            stepType: "select-packages"
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 400,
            message: "select-packages is required and cannot be skipped"
        });
    });

    it("fails with 404 when the session does not exist", async () => {
        const skipStep = vi.fn(async () => {
            throw new Error("Session not found");
        });
        const { useCase } = createContext({ upgradeSessionService: { skipStep } });

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "missing-session",
            stepType: "refresh-transient"
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 404,
            message: "Session not found"
        });
    });

    it("fails with 500 when the service throws an unexpected error", async () => {
        const skipStep = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ upgradeSessionService: { skipStep } });

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "session-1",
            stepType: "refresh-transient"
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "db unavailable"
        });
    });
});
