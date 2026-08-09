import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { StepHooksRepository } from "../abstractions/StepHooksRepository.js";
import { StepHooksRepository as StepHooksRepositoryRegistration } from "../StepHooksRepository.js";

function createRepo(): StepHooksRepository.Interface {
    const container = createContainer();
    container.register(StepHooksRepositoryRegistration);
    return container.resolve(StepHooksRepository);
}

const hook: StepHooksRepository.StepHook = {
    id: "h1",
    projectId: "p1",
    position: "pre-install",
    name: "lint",
    command: "yarn lint",
    type: "command",
    required: false,
    enabled: true,
    sortOrder: 0,
    source: "db",
    createdAt: 1000,
    updatedAt: 1000
};

describe("StepHooksRepository", () => {
    it("returns an empty array when no hooks have been set", () => {
        const repo = createRepo();

        expect(repo.getHooks()).toEqual([]);
    });

    it("stores and retrieves hooks", () => {
        const repo = createRepo();

        repo.setHooks([hook]);

        expect(repo.getHooks()).toEqual([hook]);
    });

    it("overwrites previously stored hooks", () => {
        const repo = createRepo();
        repo.setHooks([hook]);
        const otherHook = { ...hook, id: "h2" };

        repo.setHooks([otherHook]);

        expect(repo.getHooks()).toEqual([otherHook]);
    });

    it("stores and retrieves discoveredScripts", () => {
        const repo = createRepo();
        const scripts: StepHooksRepository.DiscoveredScript[] = [
            { name: "test", command: "vitest" },
            { name: "lint", command: "oxlint" }
        ];

        repo.setDiscoveredScripts(scripts);

        expect(repo.getDiscoveredScripts()).toEqual(scripts);
    });
});
