import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import { StepHooksGateway } from "../../../../features/stepHooks/abstractions/StepHooksGateway.js";
import { StepHooksRepository as StepHooksRepositoryRegistration } from "../../../../features/stepHooks/StepHooksRepository.js";
import { StepHooksPresenter } from "../abstractions/StepHooksPresenter.js";
import { StepHooksPresenter as StepHooksPresenterRegistration } from "../StepHooksPresenter.js";

interface MockGateway {
    list: ReturnType<typeof vi.fn<(projectId: string) => Promise<StepHooksGateway.ListResult>>>;
    create: ReturnType<
        typeof vi.fn<
            (
                projectId: string,
                input: StepHooksGateway.CreateInput
            ) => Promise<StepHooksGateway.StepHook>
        >
    >;
    update: ReturnType<
        typeof vi.fn<
            (
                projectId: string,
                hookId: string,
                input: StepHooksGateway.UpdateInput
            ) => Promise<StepHooksGateway.StepHook>
        >
    >;
    remove: ReturnType<typeof vi.fn<(projectId: string, hookId: string) => Promise<void>>>;
}

function createMockGateway(): MockGateway {
    return {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn()
    };
}

describe("StepHooksPresenter", () => {
    let mockGateway: MockGateway;
    let presenter: StepHooksPresenter.Interface;

    beforeEach(() => {
        mockGateway = createMockGateway();

        const container: Container = createContainer();
        container.registerInstance(StepHooksGateway, mockGateway);
        container.register(StepHooksRepositoryRegistration);
        container.register(StepHooksPresenterRegistration);

        presenter = container.resolve(StepHooksPresenter);
    });

    it("load populates discoveredScripts in vm", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [],
            configSource: "db",
            discoveredScripts: [
                { name: "test", command: "vitest" },
                { name: "lint", command: "oxlint" }
            ]
        });

        await presenter.load("p1");

        expect(presenter.vm.discoveredScripts).toHaveLength(2);
        expect(presenter.vm.discoveredScripts[0]!.name).toBe("test");
        expect(presenter.vm.discoveredScripts[1]!.name).toBe("lint");
    });

    it("load sets configSource to file when file config is active", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [
                {
                    id: "file-0",
                    projectId: "p1",
                    position: "pre-upgrade",
                    name: "Lint",
                    command: "yarn lint",
                    type: "command",
                    required: true,
                    enabled: true,
                    sortOrder: 0,
                    source: "file",
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
            ],
            configSource: "file",
            discoveredScripts: []
        });

        await presenter.load("p1");

        expect(presenter.vm.configSource).toBe("file");
    });

    it("openFormWithDefaults pre-fills form defaults", () => {
        presenter.openFormWithDefaults({
            name: "test",
            command: "yarn test",
            type: "package-script"
        });

        expect(presenter.vm.formOpen).toBe(true);
        expect(presenter.vm.formDefaults).toEqual({
            name: "test",
            command: "yarn test",
            type: "package-script"
        });
        expect(presenter.vm.editingHookId).toBeNull();
    });

    it("closeForm clears formDefaults", () => {
        presenter.openFormWithDefaults({
            name: "test",
            command: "yarn test",
            type: "package-script"
        });

        presenter.closeForm();

        expect(presenter.vm.formOpen).toBe(false);
        expect(presenter.vm.formDefaults).toBeNull();
    });

    it("load sets loading to false after successful load", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [],
            configSource: "db",
            discoveredScripts: []
        });

        await presenter.load("p1");

        expect(presenter.vm.loading).toBe(false);
    });

    it("load sets error when gateway rejects", async () => {
        mockGateway.list.mockRejectedValue(new Error("Network error"));

        await presenter.load("p1");

        expect(presenter.vm.error).toBe("Network error");
        expect(presenter.vm.loading).toBe(false);
    });

    it("vm.hooks maps hook entries from repository", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [
                {
                    id: "h1",
                    projectId: "p1",
                    position: "pre-upgrade",
                    name: "Lint",
                    command: "yarn lint",
                    type: "command" as const,
                    required: false,
                    enabled: true,
                    sortOrder: 0,
                    source: "db" as const,
                    createdAt: 1000,
                    updatedAt: 1000
                }
            ],
            configSource: "db",
            discoveredScripts: []
        });

        await presenter.load("p1");

        expect(presenter.vm.hooks).toHaveLength(1);
        expect(presenter.vm.hooks[0]).toEqual({
            id: "h1",
            position: "pre-upgrade",
            name: "Lint",
            command: "yarn lint",
            type: "command",
            required: false,
            enabled: true,
            sortOrder: 0,
            source: "db"
        });
    });

    it("create calls gateway.create then reloads and closes form", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [],
            configSource: "db",
            discoveredScripts: []
        });
        mockGateway.create.mockResolvedValue({
            id: "h2",
            projectId: "p1",
            position: "pre-upgrade",
            name: "Test",
            command: "yarn test",
            type: "command" as const,
            required: false,
            enabled: true,
            sortOrder: 0,
            source: "db" as const,
            createdAt: 1000,
            updatedAt: 1000
        });

        await presenter.load("p1");
        presenter.openForm();

        await presenter.create({
            position: "pre-upgrade",
            name: "Test",
            command: "yarn test",
            type: "command",
            required: false
        });

        expect(mockGateway.create).toHaveBeenCalledWith("p1", {
            position: "pre-upgrade",
            name: "Test",
            command: "yarn test",
            type: "command",
            required: false
        });
        expect(mockGateway.list).toHaveBeenCalledTimes(2);
        expect(presenter.vm.formOpen).toBe(false);
    });

    it("create sets error when gateway rejects", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [],
            configSource: "db",
            discoveredScripts: []
        });
        mockGateway.create.mockRejectedValue(new Error("Create failed"));

        await presenter.load("p1");

        await presenter.create({
            position: "pre-upgrade",
            name: "Test",
            command: "yarn test",
            type: "command",
            required: false
        });

        expect(presenter.vm.error).toBe("Create failed");
    });

    it("create does nothing when projectId is not set", async () => {
        await presenter.create({
            position: "pre-upgrade",
            name: "Test",
            command: "yarn test",
            type: "command",
            required: false
        });

        expect(mockGateway.create).not.toHaveBeenCalled();
    });

    it("update calls gateway.update then reloads and closes form", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [
                {
                    id: "h1",
                    projectId: "p1",
                    position: "pre-upgrade",
                    name: "Lint",
                    command: "yarn lint",
                    type: "command" as const,
                    required: false,
                    enabled: true,
                    sortOrder: 0,
                    source: "db" as const,
                    createdAt: 1000,
                    updatedAt: 1000
                }
            ],
            configSource: "db",
            discoveredScripts: []
        });
        mockGateway.update.mockResolvedValue({
            id: "h1",
            projectId: "p1",
            position: "pre-upgrade",
            name: "Lint Updated",
            command: "yarn lint --fix",
            type: "command" as const,
            required: false,
            enabled: true,
            sortOrder: 0,
            source: "db" as const,
            createdAt: 1000,
            updatedAt: 2000
        });

        await presenter.load("p1");
        presenter.openForm("h1");

        await presenter.update("h1", { name: "Lint Updated", command: "yarn lint --fix" });

        expect(mockGateway.update).toHaveBeenCalledWith("p1", "h1", {
            name: "Lint Updated",
            command: "yarn lint --fix"
        });
        expect(mockGateway.list).toHaveBeenCalledTimes(2);
        expect(presenter.vm.formOpen).toBe(false);
    });

    it("update sets error when gateway rejects", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [],
            configSource: "db",
            discoveredScripts: []
        });
        mockGateway.update.mockRejectedValue(new Error("Update failed"));

        await presenter.load("p1");

        await presenter.update("h1", { name: "Updated" });

        expect(presenter.vm.error).toBe("Update failed");
    });

    it("update does nothing when projectId is not set", async () => {
        await presenter.update("h1", { name: "Updated" });

        expect(mockGateway.update).not.toHaveBeenCalled();
    });

    it("remove calls gateway.remove then reloads", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [
                {
                    id: "h1",
                    projectId: "p1",
                    position: "pre-upgrade",
                    name: "Lint",
                    command: "yarn lint",
                    type: "command" as const,
                    required: false,
                    enabled: true,
                    sortOrder: 0,
                    source: "db" as const,
                    createdAt: 1000,
                    updatedAt: 1000
                }
            ],
            configSource: "db",
            discoveredScripts: []
        });
        mockGateway.remove.mockResolvedValue(undefined);

        await presenter.load("p1");

        await presenter.remove("h1");

        expect(mockGateway.remove).toHaveBeenCalledWith("p1", "h1");
        expect(mockGateway.list).toHaveBeenCalledTimes(2);
    });

    it("remove sets error when gateway rejects", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [],
            configSource: "db",
            discoveredScripts: []
        });
        mockGateway.remove.mockRejectedValue(new Error("Remove failed"));

        await presenter.load("p1");

        await presenter.remove("h1");

        expect(presenter.vm.error).toBe("Remove failed");
    });

    it("remove does nothing when projectId is not set", async () => {
        await presenter.remove("h1");

        expect(mockGateway.remove).not.toHaveBeenCalled();
    });

    it("toggleEnabled toggles enabled state of hook", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [
                {
                    id: "h1",
                    projectId: "p1",
                    position: "pre-upgrade",
                    name: "Lint",
                    command: "yarn lint",
                    type: "command" as const,
                    required: false,
                    enabled: true,
                    sortOrder: 0,
                    source: "db" as const,
                    createdAt: 1000,
                    updatedAt: 1000
                }
            ],
            configSource: "db",
            discoveredScripts: []
        });
        mockGateway.update.mockResolvedValue({
            id: "h1",
            projectId: "p1",
            position: "pre-upgrade",
            name: "Lint",
            command: "yarn lint",
            type: "command" as const,
            required: false,
            enabled: false,
            sortOrder: 0,
            source: "db" as const,
            createdAt: 1000,
            updatedAt: 2000
        });

        await presenter.load("p1");

        await presenter.toggleEnabled("h1");

        expect(mockGateway.update).toHaveBeenCalledWith("p1", "h1", { enabled: false });
    });

    it("toggleEnabled does nothing when hook not found", async () => {
        mockGateway.list.mockResolvedValue({
            hooks: [],
            configSource: "db",
            discoveredScripts: []
        });

        await presenter.load("p1");

        await presenter.toggleEnabled("nonexistent");

        expect(mockGateway.update).not.toHaveBeenCalled();
    });

    it("openForm sets formOpen and editingHookId", () => {
        presenter.openForm("h1");

        expect(presenter.vm.formOpen).toBe(true);
        expect(presenter.vm.editingHookId).toBe("h1");
    });

    it("openForm without hookId sets editingHookId to null", () => {
        presenter.openForm();

        expect(presenter.vm.formOpen).toBe(true);
        expect(presenter.vm.editingHookId).toBeNull();
    });
});
