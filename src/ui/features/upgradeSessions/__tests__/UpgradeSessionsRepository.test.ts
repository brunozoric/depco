import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { UpgradeSessionsRepository } from "../abstractions/UpgradeSessionsRepository.js";
import { UpgradeSessionsRepository as UpgradeSessionsRepositoryRegistration } from "../UpgradeSessionsRepository.js";
import type { UpgradeSessionsGateway } from "../abstractions/UpgradeSessionsGateway.js";

function createRepo(): UpgradeSessionsRepository.Interface {
    const container = createContainer();
    container.register(UpgradeSessionsRepositoryRegistration);
    return container.resolve(UpgradeSessionsRepository);
}

const session: UpgradeSessionsGateway.SessionResponse = {
    id: "s1",
    projectId: "p1",
    status: "active",
    currentStep: "select-packages",
    steps: [
        {
            type: "select-packages",
            status: "active",
            input: {},
            result: {}
        }
    ],
    stepOrder: ["select-packages", "branch", "upgrade", "refresh-transient", "commit"],
    createdAt: 1000,
    updatedAt: 1000
};

describe("UpgradeSessionsRepository", () => {
    it("returns null when no session has been set", () => {
        const repo = createRepo();

        expect(repo.getSession()).toBeNull();
    });

    it("stores and retrieves a session", () => {
        const repo = createRepo();

        repo.setSession(session);

        expect(repo.getSession()).toEqual(session);
    });

    it("overwrites previously stored session", () => {
        const repo = createRepo();
        repo.setSession(session);
        const otherSession: UpgradeSessionsGateway.SessionResponse = {
            ...session,
            id: "s2",
            currentStep: "branch"
        };

        repo.setSession(otherSession);

        expect(repo.getSession()).toEqual(otherSession);
    });

    it("clears session when set to null", () => {
        const repo = createRepo();
        repo.setSession(session);

        repo.setSession(null);

        expect(repo.getSession()).toBeNull();
    });
});
