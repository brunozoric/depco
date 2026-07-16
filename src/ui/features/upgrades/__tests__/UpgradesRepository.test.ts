import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { UpgradesRepository } from "../abstractions/UpgradesRepository.js";
import { UpgradesRepository as UpgradesRepositoryReg } from "../UpgradesRepository.js";

function createRepo(): UpgradesRepository.Interface {
    const container = createContainer();
    container.register(UpgradesRepositoryReg);
    return container.resolve(UpgradesRepository);
}

const job: UpgradesRepository.Job = {
    id: "job-1",
    referenceId: "p1",
    referenceType: "project",
    type: "dependency",
    status: "completed",
    packages: "[]",
    logs: "done",
    startedAt: 1000,
    completedAt: 2000,
    warning: null,
    progress: null,
    progressLabel: null
};

describe("UpgradesRepository", () => {
    it("returns an empty array for a project with no jobs", () => {
        const repo = createRepo();

        expect(repo.getJobs("unknown")).toEqual([]);
    });

    it("stores and retrieves jobs for a project", () => {
        const repo = createRepo();

        repo.setJobs("p1", [job]);

        expect(repo.getJobs("p1")).toEqual([job]);
    });

    it("returns undefined for an active job that was never set", () => {
        const repo = createRepo();

        expect(repo.getActiveJob("p1")).toBeUndefined();
    });

    it("stores and retrieves the active job for a project", () => {
        const repo = createRepo();

        repo.setActiveJob("p1", job);

        expect(repo.getActiveJob("p1")).toEqual(job);
    });

    it("removes the active job when set to undefined", () => {
        const repo = createRepo();
        repo.setActiveJob("p1", job);

        repo.setActiveJob("p1", undefined);

        expect(repo.getActiveJob("p1")).toBeUndefined();
    });

    it("returns undefined for package manager info that was never set", () => {
        const repo = createRepo();

        expect(repo.getPackageManagerInfo("p1")).toBeUndefined();
    });

    it("stores and retrieves package manager info for a project", () => {
        const repo = createRepo();

        repo.setPackageManagerInfo("p1", { version: "4.2.0" });

        expect(repo.getPackageManagerInfo("p1")).toEqual({ version: "4.2.0" });
    });

    it("clears all stored data for a project", () => {
        const repo = createRepo();
        repo.setJobs("p1", [job]);
        repo.setActiveJob("p1", job);
        repo.setPackageManagerInfo("p1", { version: "4.2.0" });

        repo.clear("p1");

        expect(repo.getJobs("p1")).toEqual([]);
        expect(repo.getActiveJob("p1")).toBeUndefined();
        expect(repo.getPackageManagerInfo("p1")).toBeUndefined();
    });

    it("does not affect other projects when clearing one project", () => {
        const repo = createRepo();
        repo.setJobs("p1", [job]);
        repo.setJobs("p2", [job]);

        repo.clear("p1");

        expect(repo.getJobs("p1")).toEqual([]);
        expect(repo.getJobs("p2")).toEqual([job]);
    });
});
