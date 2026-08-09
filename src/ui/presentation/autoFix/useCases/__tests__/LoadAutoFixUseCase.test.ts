import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    getAutoFixSettingsRoute,
    getProjectAutoFixPullRequestsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { AutoFixFeature } from "../../../../features/AutoFix/feature.js";
import { AutoFixRepository } from "../../../../features/AutoFix/abstractions/AutoFixRepository.js";
import { LoadAutoFixUseCase } from "../abstractions/LoadAutoFixUseCase.js";
import { LoadAutoFixUseCase as LoadAutoFixUseCaseRegistration } from "../LoadAutoFixUseCase.js";
import type { AutoFixGateway } from "../../../../features/AutoFix/abstractions/AutoFixGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    repository: AutoFixRepository.Interface;
    useCase: LoadAutoFixUseCase.Interface;
}

describe("LoadAutoFixUseCase", () => {
    let calls: RecordedCall[];
    let mockResults: Record<string, unknown>;

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (route === getAutoFixSettingsRoute) {
                    return mockResults["settings"] as T;
                }
                if (route === getProjectAutoFixPullRequestsRoute) {
                    return mockResults["pullRequests"] as T;
                }
                throw new Error("Unexpected route");
            }
        });
        AutoFixFeature.register(container);
        container.register(LoadAutoFixUseCaseRegistration);

        return {
            repository: container.resolve(AutoFixRepository),
            useCase: container.resolve(LoadAutoFixUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResults = {
            settings: {
                id: "settings1",
                projectId: "project-1",
                enabled: true,
                upgradeTypes: ["patch"],
                groupingStrategy: "single",
                branchPrefix: "auto-fix/",
                createdAt: 1000,
                updatedAt: 1000
            },
            pullRequests: { items: [], total: 0 }
        };
    });

    it("fetches settings and pull requests, storing both in the repository", async () => {
        const context = createContext();
        const pullRequest: AutoFixGateway.PullRequest = {
            id: "pr1",
            projectId: "project-1",
            packageNames: ["lodash"],
            fromVersions: { lodash: "1.0.0" },
            toVersions: { lodash: "1.1.0" },
            upgradeType: "patch",
            branchName: "auto-fix/lodash",
            prUrl: null,
            prNumber: null,
            status: "pending",
            licenseWarnings: [],
            createdAt: 1000,
            updatedAt: 1000
        };
        mockResults["pullRequests"] = { items: [pullRequest], total: 1 };

        await context.useCase.execute("project-1");

        expect(calls).toEqual([
            { route: getAutoFixSettingsRoute, args: { params: { projectId: "project-1" } } },
            {
                route: getProjectAutoFixPullRequestsRoute,
                args: { params: { projectId: "project-1" }, query: undefined }
            }
        ]);
        expect(context.repository.getSettings()).toEqual(mockResults["settings"]);
        expect(context.repository.getPullRequests()).toEqual([pullRequest]);
        expect(context.repository.getPullRequestsTotal()).toBe(1);
    });
});
