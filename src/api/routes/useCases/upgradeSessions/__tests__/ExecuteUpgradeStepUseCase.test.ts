import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { UpgradeSessionsUseCasesFeature } from "../feature.js";
import { ExecuteUpgradeStepUseCase } from "../abstractions/ExecuteUpgradeStepUseCase.js";

interface ICreateContextOptions {
    upgradeSessionService?: Partial<UpgradeSessionService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: ExecuteUpgradeStepUseCase.Interface;
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

    return { container, useCase: container.resolve(ExecuteUpgradeStepUseCase) };
}

function createSessionFixture(): UpgradeSessionService.Row {
    return {
        id: "session-1",
        projectId: "project-1",
        status: "active",
        currentStep: "upgrade",
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

describe("ExecuteUpgradeStepUseCase", () => {
    it("executes the step and returns the updated session", async () => {
        const fixture = createSessionFixture();
        const executeStep = vi.fn(async () => fixture);
        const { useCase } = createContext({ upgradeSessionService: { executeStep } });
        const input = { packages: ["lodash"] };

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "session-1",
            stepType: "upgrade",
            input
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(executeStep).toHaveBeenCalledWith("session-1", "project-1", "upgrade", input);
    });

    it("fails with 400 when the requested step is not the current step", async () => {
        const executeStep = vi.fn(async () => {
            throw new Error("upgrade is not the current step");
        });
        const { useCase } = createContext({ upgradeSessionService: { executeStep } });

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "session-1",
            stepType: "upgrade",
            input: {}
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 400,
            message: "upgrade is not the current step"
        });
    });

    it("fails with 404 when the session does not exist", async () => {
        const executeStep = vi.fn(async () => {
            throw new Error("Session not found");
        });
        const { useCase } = createContext({ upgradeSessionService: { executeStep } });

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "missing-session",
            stepType: "upgrade",
            input: {}
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 404,
            message: "Session not found"
        });
    });

    it("fails with 500 when the service throws an unexpected error", async () => {
        const executeStep = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ upgradeSessionService: { executeStep } });

        const result = await useCase.execute({
            projectId: "project-1",
            sessionId: "session-1",
            stepType: "upgrade",
            input: {}
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "db unavailable"
        });
    });
});
