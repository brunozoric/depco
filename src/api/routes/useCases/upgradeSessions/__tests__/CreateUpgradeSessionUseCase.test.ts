import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";
import { UpgradeSessionsUseCasesFeature } from "../feature.js";
import { CreateUpgradeSessionUseCase } from "../abstractions/CreateUpgradeSessionUseCase.js";

interface ICreateContextOptions {
    upgradeSessionService?: Partial<UpgradeSessionService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: CreateUpgradeSessionUseCase.Interface;
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

    return { container, useCase: container.resolve(CreateUpgradeSessionUseCase) };
}

function createSessionFixture(): UpgradeSessionService.Row {
    return {
        id: "session-1",
        projectId: "project-1",
        status: "active",
        currentStep: "select-packages",
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

describe("CreateUpgradeSessionUseCase", () => {
    it("creates a new session for the project", async () => {
        const fixture = createSessionFixture();
        const createSession = vi.fn(async () => fixture);
        const { useCase } = createContext({ upgradeSessionService: { createSession } });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(createSession).toHaveBeenCalledWith("project-1");
    });

    it("fails with 404 when the service reports the project as not found", async () => {
        const createSession = vi.fn(async () => {
            throw new Error("Project not found");
        });
        const { useCase } = createContext({ upgradeSessionService: { createSession } });

        const result = await useCase.execute({ projectId: "missing-project" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Project not found" });
    });

    it("fails with 500 when the service throws an unexpected error", async () => {
        const createSession = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ upgradeSessionService: { createSession } });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "db unavailable" });
    });
});
