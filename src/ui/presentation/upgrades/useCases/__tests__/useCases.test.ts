import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    createUpgradeJobRoute,
    createTransientJobRoute,
    updatePackageManagerRoute,
    getJobRoute,
    listJobsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { UpgradesGateway as UpgradesGatewayRegistration } from "../../../../features/upgrades/UpgradesGateway.js";
import { UpgradesRepository } from "../../../../features/upgrades/abstractions/UpgradesRepository.js";
import { UpgradesRepository as UpgradesRepositoryRegistration } from "../../../../features/upgrades/UpgradesRepository.js";
import { UpgradePackagesUseCase } from "../abstractions/UpgradePackagesUseCase.js";
import { UpgradePackagesUseCase as UpgradePackagesUseCaseRegistration } from "../UpgradePackagesUseCase.js";
import { RefreshTransientUseCase } from "../abstractions/RefreshTransientUseCase.js";
import { RefreshTransientUseCase as RefreshTransientUseCaseRegistration } from "../RefreshTransientUseCase.js";
import { UpdatePackageManagerUseCase } from "../abstractions/UpdatePackageManagerUseCase.js";
import { UpdatePackageManagerUseCase as UpdatePackageManagerUseCaseRegistration } from "../UpdatePackageManagerUseCase.js";
import { GetJobUseCase } from "../abstractions/GetJobUseCase.js";
import { GetJobUseCase as GetJobUseCaseRegistration } from "../GetJobUseCase.js";
import { GetJobsUseCase } from "../abstractions/GetJobsUseCase.js";
import { GetJobsUseCase as GetJobsUseCaseRegistration } from "../GetJobsUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    upgradesRepository: UpgradesRepository.Interface;
    upgradePackagesUseCase: UpgradePackagesUseCase.Interface;
    refreshTransientUseCase: RefreshTransientUseCase.Interface;
    updatePackageManagerUseCase: UpdatePackageManagerUseCase.Interface;
    getJobUseCase: GetJobUseCase.Interface;
    getJobsUseCase: GetJobsUseCase.Interface;
}

describe("upgrade use cases", () => {
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
        container.register(UpgradesGatewayRegistration).inSingletonScope();
        container.register(UpgradesRepositoryRegistration).inSingletonScope();
        container.register(UpgradePackagesUseCaseRegistration);
        container.register(RefreshTransientUseCaseRegistration);
        container.register(UpdatePackageManagerUseCaseRegistration);
        container.register(GetJobUseCaseRegistration);
        container.register(GetJobsUseCaseRegistration);

        return {
            upgradesRepository: container.resolve(UpgradesRepository),
            upgradePackagesUseCase: container.resolve(UpgradePackagesUseCase),
            refreshTransientUseCase: container.resolve(RefreshTransientUseCase),
            updatePackageManagerUseCase: container.resolve(UpdatePackageManagerUseCase),
            getJobUseCase: container.resolve(GetJobUseCase),
            getJobsUseCase: container.resolve(GetJobsUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    describe("UpgradePackagesUseCase", () => {
        it("starts an upgrade via the gateway and stores the job in the repository", async () => {
            const context = createContext();
            mockResult = { item: { jobId: "job-1" } };

            await context.upgradePackagesUseCase.execute(
                "p1",
                [{ name: "left-pad", targetVersion: "2.0.0" }],
                true
            );

            expect(calls).toEqual([
                {
                    route: createUpgradeJobRoute,
                    args: {
                        params: { id: "p1" },
                        body: {
                            packages: [{ name: "left-pad", targetVersion: "2.0.0" }],
                            refreshTransient: true
                        }
                    }
                }
            ]);
            expect(context.upgradesRepository.getActiveJob("p1")).toEqual({
                id: "job-1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "pending",
                packages: JSON.stringify([{ name: "left-pad", targetVersion: "2.0.0" }]),
                logs: null,
                startedAt: null,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null
            });
        });
    });

    describe("RefreshTransientUseCase", () => {
        it("starts a transient refresh via the gateway and stores the job in the repository", async () => {
            const context = createContext();
            mockResult = { item: { jobId: "job-2" } };

            await context.refreshTransientUseCase.execute("p1");

            expect(calls).toEqual([
                { route: createTransientJobRoute, args: { params: { id: "p1" } } }
            ]);
            expect(context.upgradesRepository.getActiveJob("p1")).toEqual({
                id: "job-2",
                referenceId: "p1",
                referenceType: "project",
                type: "transient",
                status: "pending",
                packages: null,
                logs: null,
                startedAt: null,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null
            });
        });
    });

    describe("UpdatePackageManagerUseCase", () => {
        it("starts a package manager update via the gateway and stores the job in the repository", async () => {
            const context = createContext();
            mockResult = { item: { jobId: "job-3" } };

            await context.updatePackageManagerUseCase.execute("p1", "4.2.0");

            expect(calls).toEqual([
                {
                    route: updatePackageManagerRoute,
                    args: { params: { id: "p1" }, body: { version: "4.2.0" } }
                }
            ]);
            expect(context.upgradesRepository.getActiveJob("p1")).toEqual({
                id: "job-3",
                referenceId: "p1",
                referenceType: "project",
                type: "yarn",
                status: "pending",
                packages: null,
                logs: null,
                startedAt: null,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null
            });
        });
    });

    describe("GetJobUseCase", () => {
        it("fetches a job via the gateway and stores it as the active job", async () => {
            const context = createContext();
            const job = {
                id: "job-1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "completed",
                packages: "[]",
                logs: "done",
                startedAt: 1000,
                completedAt: 2000,
                warning: null
            };
            mockResult = { item: job };

            await context.getJobUseCase.execute("p1", "job-1");

            expect(calls).toEqual([
                { route: getJobRoute, args: { params: { id: "p1", jobId: "job-1" } } }
            ]);
            expect(context.upgradesRepository.getActiveJob("p1")).toEqual(job);
        });
    });

    describe("GetJobsUseCase", () => {
        it("fetches job history via the gateway and stores it in the repository", async () => {
            const context = createContext();
            const job = {
                id: "job-1",
                referenceId: "p1",
                referenceType: "project",
                type: "transient",
                status: "pending",
                packages: null,
                logs: null,
                startedAt: null,
                completedAt: null,
                warning: null
            };
            mockResult = { items: [job], total: 1 };

            await context.getJobsUseCase.execute("p1");

            expect(calls).toEqual([{ route: listJobsRoute, args: { params: { id: "p1" } } }]);
            expect(context.upgradesRepository.getJobs("p1")).toEqual([job]);
        });
    });
});
