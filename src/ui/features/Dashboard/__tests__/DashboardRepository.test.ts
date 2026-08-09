import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { DashboardRepository } from "../abstractions/DashboardRepository.js";
import { DashboardRepository as DashboardRepositoryRegistration } from "../DashboardRepository.js";

function createRepo(): DashboardRepository.Interface {
    const container = createContainer();
    container.register(DashboardRepositoryRegistration);
    return container.resolve(DashboardRepository);
}

describe("DashboardRepository", () => {
    describe("health response", () => {
        it("returns null when no health response set", () => {
            const repo = createRepo();

            expect(repo.getHealthResponse()).toBeNull();
        });

        it("stores and retrieves health response", () => {
            const repo = createRepo();
            const response = {
                summary: { totalProjects: 1, averageScore: 90, worstProject: null },
                projects: []
            };

            repo.setHealthResponse(response);

            expect(repo.getHealthResponse()).toEqual(response);
        });
    });

    describe("trend response", () => {
        it("returns null when no trend response set", () => {
            const repo = createRepo();

            expect(repo.getTrendResponse()).toBeNull();
        });

        it("stores and retrieves trend response", () => {
            const repo = createRepo();
            const response = { items: [] };

            repo.setTrendResponse(response);

            expect(repo.getTrendResponse()).toEqual(response);
        });
    });

    describe("activity", () => {
        it("returns empty array when no activity set", () => {
            const repo = createRepo();

            expect(repo.getActivity()).toEqual([]);
        });

        it("stores and retrieves activity", () => {
            const repo = createRepo();
            const jobs = [
                {
                    id: "job-1",
                    type: "scan",
                    referenceId: "p1",
                    referenceType: "project",
                    status: "completed",
                    startedAt: 1,
                    completedAt: 2
                }
            ];

            repo.setActivity(jobs);

            expect(repo.getActivity()).toEqual(jobs);
        });
    });

    describe("staleness", () => {
        it("returns empty array when no staleness set", () => {
            const repo = createRepo();

            expect(repo.getStaleness()).toEqual([]);
        });

        it("stores and retrieves staleness", () => {
            const repo = createRepo();
            const projects = [{ projectId: "p1", projectName: "Project 1", lastScannedAt: 123 }];

            repo.setStaleness(projects);

            expect(repo.getStaleness()).toEqual(projects);
        });
    });

    describe("security", () => {
        it("returns empty array when no security set", () => {
            const repo = createRepo();

            expect(repo.getSecurity()).toEqual([]);
        });

        it("stores and retrieves security", () => {
            const repo = createRepo();
            const projects = [
                { projectId: "p1", projectName: "Project 1", totalChecks: 5, passingChecks: 4 }
            ];

            repo.setSecurity(projects);

            expect(repo.getSecurity()).toEqual(projects);
        });
    });

    describe("vulnerability trend", () => {
        it("returns empty array when no vulnerability trend set", () => {
            const repo = createRepo();

            expect(repo.getVulnerabilityTrend()).toEqual([]);
        });

        it("stores and retrieves vulnerability trend points", () => {
            const repo = createRepo();
            const points = [{ date: "2026-07-01", critical: 1, high: 2, moderate: 0, low: 0 }];

            repo.setVulnerabilityTrend(points);

            expect(repo.getVulnerabilityTrend()).toEqual(points);
        });
    });

    describe("license compliance summary", () => {
        it("returns null when no license compliance summary set", () => {
            const repo = createRepo();

            expect(repo.getLicenseComplianceSummary()).toBeNull();
        });

        it("stores and retrieves the license compliance summary", () => {
            const repo = createRepo();
            const summary = {
                totalPackages: 10,
                compliantPercent: 90,
                riskTierCounts: {
                    permissive: 8,
                    "weak-copyleft": 1,
                    copyleft: 0,
                    proprietary: 1,
                    unknown: 0
                },
                violationCounts: { warn: 1, deny: 0 }
            };

            repo.setLicenseComplianceSummary(summary);

            expect(repo.getLicenseComplianceSummary()).toEqual(summary);
        });
    });

    describe("open auto-fix PR count", () => {
        it("returns 0 when no count set", () => {
            const repo = createRepo();

            expect(repo.getOpenAutoFixPrCount()).toBe(0);
        });

        it("stores and retrieves the open auto-fix PR count", () => {
            const repo = createRepo();

            repo.setOpenAutoFixPrCount(3);

            expect(repo.getOpenAutoFixPrCount()).toBe(3);
        });
    });
});
