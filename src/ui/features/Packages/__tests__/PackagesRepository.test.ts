import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackagesRepository } from "../abstractions/PackagesRepository.js";
import { PackagesRepository as PackagesRepositoryRegistration } from "../PackagesRepository.js";
import type { PackagesGateway } from "../abstractions/PackagesGateway.js";

function createRepo(): PackagesRepository.Interface {
    const container = createContainer();
    container.register(PackagesRepositoryRegistration);
    return container.resolve(PackagesRepository);
}

const pkg: PackagesGateway.PackageListItem = {
    name: "left-pad",
    projects: [
        {
            projectId: "p1",
            projectName: "my-project",
            currentVersion: "1.0.0",
            latestVersion: "2.0.0",
            upgradeType: "major"
        }
    ],
    changelogCount: 3,
    lastPublishedAt: 1000,
    dependencyKind: "dependency",
    registryResolved: true
};

describe("PackagesRepository", () => {
    it("starts empty with no packages and zero total", () => {
        const repo = createRepo();

        expect(repo.getPackages()).toEqual([]);
        expect(repo.getTotal()).toBe(0);
    });

    it("stores packages and total via setPackages and retrieves them via getters", () => {
        const repo = createRepo();

        repo.setPackages([pkg], 1);

        expect(repo.getPackages()).toEqual([pkg]);
        expect(repo.getTotal()).toBe(1);
    });

    it("overwrites previously stored packages", () => {
        const repo = createRepo();
        repo.setPackages([pkg], 1);

        const otherPkg: PackagesGateway.PackageListItem = {
            name: "right-pad",
            projects: [],
            changelogCount: 0,
            lastPublishedAt: null,
            dependencyKind: "dependency",
            registryResolved: true
        };
        repo.setPackages([otherPkg], 5);

        expect(repo.getPackages()).toEqual([otherPkg]);
        expect(repo.getTotal()).toBe(5);
    });
});
