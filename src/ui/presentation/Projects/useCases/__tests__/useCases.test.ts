import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    listProjectsRoute,
    createProjectRoute,
    deleteProjectRoute,
    scanProjectAsyncRoute,
    checkProjectSecurityRoute,
    cloneProjectRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { ProjectsGateway } from "../../../../features/Projects/abstractions/ProjectsGateway.js";
import { ProjectsGateway as ProjectsGatewayRegistration } from "../../../../features/Projects/ProjectsGateway.js";
import { ProjectsRepository } from "../../../../features/Projects/abstractions/ProjectsRepository.js";
import { ProjectsRepository as ProjectsRepositoryRegistration } from "../../../../features/Projects/ProjectsRepository.js";
import { LoadProjectsUseCase } from "../abstractions/LoadProjectsUseCase.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseRegistration } from "../LoadProjectsUseCase.js";
import { AddProjectUseCase } from "../abstractions/AddProjectUseCase.js";
import { AddProjectUseCase as AddProjectUseCaseRegistration } from "../AddProjectUseCase.js";
import { RemoveProjectUseCase } from "../abstractions/RemoveProjectUseCase.js";
import { RemoveProjectUseCase as RemoveProjectUseCaseRegistration } from "../RemoveProjectUseCase.js";
import { ScanProjectUseCase } from "../abstractions/ScanProjectUseCase.js";
import { ScanProjectUseCase as ScanProjectUseCaseRegistration } from "../ScanProjectUseCase.js";
import { CheckSecurityUseCase } from "../abstractions/CheckSecurityUseCase.js";
import { CheckSecurityUseCase as CheckSecurityUseCaseRegistration } from "../CheckSecurityUseCase.js";
import { CloneProjectUseCase } from "../abstractions/CloneProjectUseCase.js";
import { CloneProjectUseCase as CloneProjectUseCaseRegistration } from "../CloneProjectUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    projectsRepository: ProjectsRepository.Interface;
    loadProjectsUseCase: LoadProjectsUseCase.Interface;
    addProjectUseCase: AddProjectUseCase.Interface;
    removeProjectUseCase: RemoveProjectUseCase.Interface;
    scanProjectUseCase: ScanProjectUseCase.Interface;
    checkSecurityUseCase: CheckSecurityUseCase.Interface;
    cloneProjectUseCase: CloneProjectUseCase.Interface;
}

describe("project use cases", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(ProjectsGatewayRegistration).inSingletonScope();
        container.register(ProjectsRepositoryRegistration).inSingletonScope();
        container.register(LoadProjectsUseCaseRegistration);
        container.register(AddProjectUseCaseRegistration);
        container.register(RemoveProjectUseCaseRegistration);
        container.register(ScanProjectUseCaseRegistration);
        container.register(CheckSecurityUseCaseRegistration);
        container.register(CloneProjectUseCaseRegistration);

        return {
            projectsRepository: container.resolve(ProjectsRepository),
            loadProjectsUseCase: container.resolve(LoadProjectsUseCase),
            addProjectUseCase: container.resolve(AddProjectUseCase),
            removeProjectUseCase: container.resolve(RemoveProjectUseCase),
            scanProjectUseCase: container.resolve(ScanProjectUseCase),
            checkSecurityUseCase: container.resolve(CheckSecurityUseCase),
            cloneProjectUseCase: container.resolve(CloneProjectUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    describe("LoadProjectsUseCase", () => {
        it("loads projects from the gateway and stores them in the repository", async () => {
            const context = createContext();
            const project = {
                id: "p1",
                name: "test-project",
                path: "/tmp/test-project",
                pmVersion: "4.1.0",
                addedAt: 1000,
                lastScannedAt: null,
                security: null,
                hasNodeModules: false
            };
            mockResult = { items: [project], total: 1 };

            await context.loadProjectsUseCase.execute();

            expect(calls).toEqual([{ route: listProjectsRoute, args: { params: {} } }]);
            expect(context.projectsRepository.getProjects()).toEqual([{ ...project, teams: [] }]);
        });
    });

    describe("AddProjectUseCase", () => {
        it("creates a project via the gateway and appends it to the repository", async () => {
            const context = createContext();
            const existingProject: ProjectsGateway.Project = {
                id: "p1",
                name: "existing-project",
                path: "/tmp/existing-project",
                packageManager: "yarn",
                pmVersion: "4.1.0",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            };
            context.projectsRepository.setProjects([existingProject]);

            const created = {
                id: "p2",
                name: "new-project",
                path: "/tmp/new-project",
                pmVersion: null,
                addedAt: 2000,
                lastScannedAt: null,
                security: null,
                hasNodeModules: false
            };
            mockResult = { item: created };

            await context.addProjectUseCase.execute("/tmp/new-project");

            expect(calls).toEqual([
                {
                    route: createProjectRoute,
                    args: { params: {}, body: { path: "/tmp/new-project" } }
                }
            ]);
            expect(context.projectsRepository.getProjects()).toEqual([
                existingProject,
                { ...created, teams: [] }
            ]);
        });
    });

    describe("RemoveProjectUseCase", () => {
        it("removes a project via the gateway and drops it from the repository", async () => {
            const context = createContext();
            const remainingProject: ProjectsGateway.Project = {
                id: "p1",
                name: "keep-me",
                path: "/tmp/keep-me",
                packageManager: "yarn",
                pmVersion: "4.1.0",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            };
            const removedProject: ProjectsGateway.Project = {
                id: "p2",
                name: "remove-me",
                path: "/tmp/remove-me",
                packageManager: "yarn",
                pmVersion: "4.1.0",
                addedAt: 1500,
                lastScannedAt: null,
                hasNodeModules: false
            };
            context.projectsRepository.setProjects([remainingProject, removedProject]);
            context.projectsRepository.setSecurityStatus("p2", {
                passes: true,
                checks: {
                    npmPreapprovedPackages: true,
                    npmMinimalAgeGate: true,
                    enableScripts: false,
                    approvedGitRepositories: true
                }
            });

            await context.removeProjectUseCase.execute("p2");

            expect(calls).toEqual([{ route: deleteProjectRoute, args: { params: { id: "p2" } } }]);
            expect(context.projectsRepository.getProjects()).toEqual([remainingProject]);
            expect(context.projectsRepository.getSecurityStatus("p2")).toBeUndefined();
        });
    });

    describe("ScanProjectUseCase", () => {
        it("enqueues an async scan job via the gateway and returns the jobId", async () => {
            const context = createContext();
            mockResult = { item: { jobId: "job-1" } };

            const jobId = await context.scanProjectUseCase.execute("p1");

            expect(calls).toEqual([
                { route: scanProjectAsyncRoute, args: { params: { id: "p1" }, query: undefined } }
            ]);
            expect(jobId).toBe("job-1");
        });

        it("passes force through to the gateway", async () => {
            const context = createContext();
            mockResult = { item: { jobId: "job-2" } };

            await context.scanProjectUseCase.execute("p1", true);

            expect(calls).toEqual([
                {
                    route: scanProjectAsyncRoute,
                    args: { params: { id: "p1" }, query: { force: "true" } }
                }
            ]);
        });
    });

    describe("CheckSecurityUseCase", () => {
        it("triggers a security check via the gateway and stores the result in the repository", async () => {
            const context = createContext();
            const security = {
                passes: false,
                checks: {
                    npmPreapprovedPackages: false,
                    npmMinimalAgeGate: true,
                    enableScripts: true,
                    approvedGitRepositories: true
                }
            };
            mockResult = { item: security };

            await context.checkSecurityUseCase.execute("p1");

            expect(calls).toEqual([
                { route: checkProjectSecurityRoute, args: { params: { id: "p1" } } }
            ]);
            expect(context.projectsRepository.getSecurityStatus("p1")).toEqual(security);
        });
    });

    describe("CloneProjectUseCase", () => {
        it("clones a repo via the gateway and returns the jobId", async () => {
            const context = createContext();
            mockResult = { item: { jobId: "job-3" } };

            const jobId = await context.cloneProjectUseCase.execute(
                "https://github.com/org/repo.git",
                "/tmp/projects",
                "my-repo"
            );

            expect(calls).toEqual([
                {
                    route: cloneProjectRoute,
                    args: {
                        params: {},
                        body: {
                            url: "https://github.com/org/repo.git",
                            destination: "/tmp/projects",
                            folderName: "my-repo"
                        }
                    }
                }
            ]);
            expect(jobId).toBe("job-3");
        });

        it("omits folderName when not provided", async () => {
            const context = createContext();
            mockResult = { item: { jobId: "job-4" } };

            await context.cloneProjectUseCase.execute(
                "https://github.com/org/repo.git",
                "/tmp/projects"
            );

            expect(calls).toEqual([
                {
                    route: cloneProjectRoute,
                    args: {
                        params: {},
                        body: {
                            url: "https://github.com/org/repo.git",
                            destination: "/tmp/projects"
                        }
                    }
                }
            ]);
        });
    });
});
