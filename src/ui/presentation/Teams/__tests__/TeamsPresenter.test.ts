import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { TeamsGateway as TeamsGatewayAbstraction } from "../../../features/Teams/abstractions/TeamsGateway.js";
import type { TeamsGateway } from "../../../features/Teams/abstractions/TeamsGateway.js";
import { TeamsRepository as TeamsRepositoryRegistration } from "../../../features/Teams/TeamsRepository.js";
import { LoadTeamsUseCase as LoadTeamsUseCaseRegistration } from "../useCases/LoadTeamsUseCase.js";
import { ManageTeamUseCase as ManageTeamUseCaseRegistration } from "../useCases/ManageTeamUseCase.js";
import { TeamsPresenter } from "../TeamsPage/abstractions/TeamsPresenter.js";
import { TeamsPresenter as TeamsPresenterRegistration } from "../TeamsPage/TeamsPresenter.js";
import { ProjectsRepository as ProjectsRepositoryRegistration } from "../../../features/Projects/ProjectsRepository.js";
import { ProjectsGateway as ProjectsGatewayAbstraction } from "../../../features/Projects/abstractions/ProjectsGateway.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseRegistration } from "../../Projects/useCases/LoadProjectsUseCase.js";

interface RecordedGatewayCall {
    method: string;
    args: unknown;
}

interface MockGatewayState {
    teams: TeamsGateway.WithStats[];
    failList: boolean;
    failCreate: boolean;
    failUpdate: boolean;
    failRemove: boolean;
}

interface MockGatewayHandle {
    gateway: TeamsGateway.Interface;
    state: MockGatewayState;
    calls: RecordedGatewayCall[];
}

function team(overrides: Partial<TeamsGateway.WithStats>): TeamsGateway.WithStats {
    return {
        id: "team-1",
        name: "Platform",
        color: "#228be6",
        createdAt: 1000,
        projectCount: 0,
        vulnerabilityCount: 0,
        compliantPercent: 100,
        averageHealthScore: 0,
        ...overrides
    };
}

function createMockGateway(initial?: Partial<MockGatewayState>): MockGatewayHandle {
    const state: MockGatewayState = {
        teams: initial?.teams ?? [],
        failList: initial?.failList ?? false,
        failCreate: initial?.failCreate ?? false,
        failUpdate: initial?.failUpdate ?? false,
        failRemove: initial?.failRemove ?? false
    };
    const calls: RecordedGatewayCall[] = [];

    const gateway: TeamsGateway.Interface = {
        list: async () => {
            calls.push({ method: "list", args: undefined });
            if (state.failList) {
                throw new Error("Failed to load teams");
            }
            return { items: state.teams, total: state.teams.length };
        },
        getDetail: async id => {
            calls.push({ method: "getDetail", args: id });
            const found = state.teams.find(item => item.id === id);
            return {
                id,
                name: found?.name ?? "",
                color: found?.color ?? "",
                createdAt: found?.createdAt ?? 0,
                projects: []
            };
        },
        create: async input => {
            calls.push({ method: "create", args: input });
            if (state.failCreate) {
                throw new Error("Failed to save team");
            }
            const created = team({
                id: `team-${state.teams.length + 1}`,
                name: input.name,
                color: input.color
            });
            state.teams = [...state.teams, created];
            return created;
        },
        update: async (id, input) => {
            calls.push({ method: "update", args: { id, input } });
            if (state.failUpdate) {
                throw new Error("Failed to save team");
            }
            state.teams = state.teams.map(item => (item.id === id ? { ...item, ...input } : item));
            const updated = state.teams.find(item => item.id === id);
            if (!updated) {
                throw new Error(`Unknown team ${id}`);
            }
            return updated;
        },
        remove: async id => {
            calls.push({ method: "remove", args: id });
            if (state.failRemove) {
                throw new Error("Failed to delete team");
            }
            state.teams = state.teams.filter(item => item.id !== id);
        },
        getProjectTeams: async () => ({ items: [], total: 0 }),
        setProjectTeams: async () => {},
        setTeamProjects: async input => {
            calls.push({ method: "setTeamProjects", args: input });
        }
    };

    return { gateway, state, calls };
}

describe("TeamsPresenter", () => {
    function createPresenter(mockGateway: MockGatewayHandle): TeamsPresenter.Interface {
        const container = createContainer();

        container.registerInstance(TeamsGatewayAbstraction, mockGateway.gateway);
        container.register(TeamsRepositoryRegistration).inSingletonScope();
        container.register(LoadTeamsUseCaseRegistration);
        container.register(ManageTeamUseCaseRegistration);
        container.registerInstance(ProjectsGatewayAbstraction, {
            list: async () => [],
            get: async () => ({}) as never,
            create: async () => ({}) as never,
            remove: async () => {},
            scan: async () => ({}) as never,
            getDependencies: async () => ({}) as never,
            getSecurity: async () => ({}) as never,
            checkSecurity: async () => ({}) as never,
            clone: async () => ({}) as never,
            install: async () => ({}) as never,
            getInstallOptions: async () => [],
            getChangelogs: async () => ({}) as never,
            reResolveChangelogs: async () => ({}) as never
        });
        container.register(ProjectsRepositoryRegistration).inSingletonScope();
        container.register(LoadProjectsUseCaseRegistration);
        container.register(TeamsPresenterRegistration);

        return container.resolve(TeamsPresenter);
    }

    let mockGateway: MockGatewayHandle;

    beforeEach(() => {
        mockGateway = createMockGateway();
    });

    describe("initial state", () => {
        it("starts with loading true and empty collections before load resolves", () => {
            const presenter = createPresenter(mockGateway);

            expect(presenter.vm.loading).toBe(true);
            expect(presenter.vm.error).toBeNull();
            expect(presenter.vm.mutationError).toBeNull();
            expect(presenter.vm.teams).toEqual([]);
            expect(presenter.vm.editingTeam).toBeNull();
            expect(presenter.vm.deletingTeamId).toBeNull();
        });
    });

    describe("load", () => {
        it("populates teams and clears the loading flag", async () => {
            mockGateway.state.teams = [
                team({ id: "team-1", name: "Platform" }),
                team({ id: "team-2", name: "Growth" })
            ];
            const presenter = createPresenter(mockGateway);

            await presenter.load();

            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.teams.map(item => item.name)).toEqual(["Platform", "Growth"]);
        });

        it("sets an error message when the gateway rejects", async () => {
            mockGateway.state.failList = true;
            const presenter = createPresenter(mockGateway);

            await presenter.load();

            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.error).toBe("Failed to load teams");
        });
    });

    describe("create/edit modal", () => {
        it("openCreateModal starts an empty form and closeModal clears it", () => {
            const presenter = createPresenter(mockGateway);

            presenter.openCreateModal();
            expect(presenter.vm.editingTeam).toEqual({
                id: null,
                name: "",
                color: "#228be6",
                projectIds: []
            });

            presenter.closeModal();
            expect(presenter.vm.editingTeam).toBeNull();
        });

        it("openEditModal seeds the form with the team's current values", () => {
            const presenter = createPresenter(mockGateway);
            const existing = team({ id: "team-1", name: "Platform", color: "#ff0000" });

            presenter.openEditModal(existing);

            expect(presenter.vm.editingTeam).toMatchObject({
                id: "team-1",
                name: "Platform",
                color: "#ff0000"
            });
        });

        it("setFormName and setFormColor update the in-progress form", () => {
            const presenter = createPresenter(mockGateway);

            presenter.openCreateModal();
            presenter.setFormName("Security");
            presenter.setFormColor("#00ff00");

            expect(presenter.vm.editingTeam).toMatchObject({
                id: null,
                name: "Security",
                color: "#00ff00"
            });
        });
    });

    describe("saveTeam", () => {
        it("creates a new team and refreshes the list", async () => {
            const presenter = createPresenter(mockGateway);

            presenter.openCreateModal();
            presenter.setFormName("Security");
            presenter.setFormColor("#00ff00");
            await presenter.saveTeam();

            expect(mockGateway.calls).toEqual([
                { method: "create", args: { name: "Security", color: "#00ff00" } },
                { method: "list", args: undefined },
                { method: "setTeamProjects", args: { teamId: "team-1", projectIds: [] } },
                { method: "list", args: undefined }
            ]);
            expect(presenter.vm.editingTeam).toBeNull();
            expect(presenter.vm.teams.map(item => item.name)).toEqual(["Security"]);
        });

        it("updates an existing team and refreshes the list", async () => {
            mockGateway.state.teams = [team({ id: "team-1", name: "Platform" })];
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            presenter.openEditModal(presenter.vm.teams[0]!);
            presenter.setFormName("Platform Engineering");
            await presenter.saveTeam();

            const updateCall = mockGateway.calls.find(call => call.method === "update");
            expect(updateCall).toEqual({
                method: "update",
                args: { id: "team-1", input: { name: "Platform Engineering", color: "#228be6" } }
            });
            expect(presenter.vm.editingTeam).toBeNull();
            expect(presenter.vm.teams.map(item => item.name)).toEqual(["Platform Engineering"]);
        });

        it("keeps the modal open and sets a mutation error when the save fails, without touching the page-level error", async () => {
            mockGateway.state.failCreate = true;
            const presenter = createPresenter(mockGateway);

            presenter.openCreateModal();
            presenter.setFormName("Security");
            await presenter.saveTeam();

            expect(presenter.vm.mutationError).toBe("Failed to save team");
            expect(presenter.vm.error).toBeNull();
            expect(presenter.vm.editingTeam).toMatchObject({
                id: null,
                name: "Security",
                color: "#228be6"
            });
        });

        it("clears a previous mutation error when a save succeeds", async () => {
            mockGateway.state.failCreate = true;
            const presenter = createPresenter(mockGateway);

            presenter.openCreateModal();
            presenter.setFormName("Security");
            await presenter.saveTeam();
            expect(presenter.vm.mutationError).toBe("Failed to save team");

            mockGateway.state.failCreate = false;
            await presenter.saveTeam();

            expect(presenter.vm.mutationError).toBeNull();
            expect(presenter.vm.editingTeam).toBeNull();
        });
    });

    describe("delete", () => {
        it("confirmDelete sets the pending id and cancelDelete clears it", () => {
            const presenter = createPresenter(mockGateway);

            presenter.confirmDelete("team-1");
            expect(presenter.vm.deletingTeamId).toBe("team-1");

            presenter.cancelDelete();
            expect(presenter.vm.deletingTeamId).toBeNull();
        });

        it("deleteTeam removes the team and refreshes the list", async () => {
            mockGateway.state.teams = [
                team({ id: "team-1", name: "Platform" }),
                team({ id: "team-2", name: "Growth" })
            ];
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            presenter.confirmDelete("team-1");
            await presenter.deleteTeam();

            expect(mockGateway.calls.at(-2)).toEqual({ method: "remove", args: "team-1" });
            expect(presenter.vm.deletingTeamId).toBeNull();
            expect(presenter.vm.teams.map(item => item.name)).toEqual(["Growth"]);
        });

        it("clears the pending id and sets a mutation error when delete fails, without touching the page-level error", async () => {
            mockGateway.state.teams = [team({ id: "team-1", name: "Platform" })];
            mockGateway.state.failRemove = true;
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            presenter.confirmDelete("team-1");
            await presenter.deleteTeam();

            expect(presenter.vm.mutationError).toBe("Failed to delete team");
            expect(presenter.vm.error).toBeNull();
            expect(presenter.vm.deletingTeamId).toBeNull();
        });
    });
});
