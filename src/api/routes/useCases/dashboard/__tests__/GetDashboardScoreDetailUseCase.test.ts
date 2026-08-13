import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, scanResults, vulnerabilities } from "#api/db/schema.js";
import { GetDashboardScoreDetailUseCase, DashboardUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    DashboardUseCasesFeature.register(container);
    const useCase = container.resolve(GetDashboardScoreDetailUseCase);
    return { useCase, db };
}

function insertProject(db: TestDb, id: string): void {
    db.insert(projects)
        .values({
            id,
            name: "p",
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now()
        })
        .run();
}

describe("GetDashboardScoreDetailUseCase", () => {
    it("returns outdated packages ordered major, minor, then patch", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        db.insert(scanResults)
            .values([
                {
                    id: generateId(),
                    projectId: "p1",
                    name: "patch-pkg",
                    currentVersion: "1.0.0",
                    latestVersion: "1.0.1",
                    type: "dependency",
                    upgradeType: "patch",
                    scannedAt: Date.now()
                },
                {
                    id: generateId(),
                    projectId: "p1",
                    name: "major-pkg",
                    currentVersion: "1.0.0",
                    latestVersion: "2.0.0",
                    type: "dependency",
                    upgradeType: "major",
                    scannedAt: Date.now()
                },
                {
                    id: generateId(),
                    projectId: "p1",
                    name: "minor-pkg",
                    currentVersion: "1.0.0",
                    latestVersion: "1.1.0",
                    type: "dependency",
                    upgradeType: "minor",
                    scannedAt: Date.now()
                },
                {
                    id: generateId(),
                    projectId: "p1",
                    name: "up-to-date",
                    currentVersion: "1.0.0",
                    latestVersion: "1.0.0",
                    type: "dependency",
                    upgradeType: "none",
                    scannedAt: Date.now()
                }
            ])
            .run();

        const result = await useCase.execute({ projectId: "p1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.outdatedPackages.map(pkg => pkg.name)).toEqual([
                "major-pkg",
                "minor-pkg",
                "patch-pkg"
            ]);
        }
    });

    it("returns active vulnerabilities with computed penalty, ordered by severity", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        db.insert(vulnerabilities)
            .values([
                {
                    id: generateId(),
                    projectId: "p1",
                    packageName: "low-pkg",
                    severity: "low",
                    title: "Low severity issue",
                    dedupKey: "low-pkg-low",
                    source: "npm-audit",
                    scannedAt: Date.now()
                },
                {
                    id: generateId(),
                    projectId: "p1",
                    packageName: "critical-pkg",
                    severity: "critical",
                    title: "Critical severity issue",
                    dedupKey: "critical-pkg-critical",
                    source: "npm-audit",
                    scannedAt: Date.now()
                }
            ])
            .run();

        const result = await useCase.execute({ projectId: "p1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.vulnerabilities.map(vuln => vuln.packageName)).toEqual([
                "critical-pkg",
                "low-pkg"
            ]);
            expect(result.value.vulnerabilities[0]!.penalty).toBe(10);
            expect(result.value.vulnerabilities[1]!.penalty).toBe(1);
        }
    });

    it("excludes vulnerabilities that are dismissed and not yet due to reappear", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        db.insert(vulnerabilities)
            .values({
                id: generateId(),
                projectId: "p1",
                packageName: "dismissed-pkg",
                severity: "high",
                title: "Dismissed issue",
                dedupKey: "dismissed-pkg-high",
                source: "npm-audit",
                scannedAt: Date.now(),
                dismissedAt: Date.now(),
                dismissedUntil: Date.now() + 1000 * 60 * 60 * 24
            })
            .run();

        const result = await useCase.execute({ projectId: "p1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.vulnerabilities).toEqual([]);
        }
    });

    it("includes vulnerabilities whose dismissal window has already passed", async () => {
        const { useCase, db } = setup();
        insertProject(db, "p1");
        db.insert(vulnerabilities)
            .values({
                id: generateId(),
                projectId: "p1",
                packageName: "reappeared-pkg",
                severity: "moderate",
                title: "Reappeared issue",
                dedupKey: "reappeared-pkg-moderate",
                source: "npm-audit",
                scannedAt: Date.now(),
                dismissedAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
                dismissedUntil: Date.now() - 1000 * 60 * 60 * 24
            })
            .run();

        const result = await useCase.execute({ projectId: "p1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.vulnerabilities).toHaveLength(1);
            expect(result.value.vulnerabilities[0]!.packageName).toBe("reappeared-pkg");
        }
    });

    it("returns empty lists for a project with no scan data", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({ projectId: "unknown-project" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ outdatedPackages: [], vulnerabilities: [] });
        }
    });
});
