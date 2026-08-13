import { describe, it, expect } from "vitest";
import { vulnerabilities } from "#api/db/schema.js";
import {
    createTestContext,
    insertTestProject,
    makeVulnerability
} from "./vulnerabilities.testHelpers.js";

// This file covers dependencyType filtering (direct/transitive) across the
// list, export, and summary routes, each against a real service context via
// createTestContext(). List/summary/per-project route shape and the detail
// route live in vulnerabilities.list.core.test.ts and
// vulnerabilities.list.detail.test.ts respectively.
describe("vulnerability routes - dependencyType filtering", () => {
    it("list route returns only direct dependencies when dependencyType=direct", async () => {
        const { app, db, token } = await createTestContext();
        try {
            await insertTestProject(db, "proj-1");

            await db.insert(vulnerabilities).values([
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "lodash",
                    dedupKey: "d1",
                    dependencyKind: "dependency"
                }),
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "transitive-pkg",
                    dedupKey: "d2",
                    dependencyKind: "transitive"
                })
            ]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities?dependencyType=direct"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.items).toHaveLength(1);
            expect(body.items[0].packageName).toBe("lodash");
            expect(body.items[0].dependencyKind).toBe("dependency");
        } finally {
            await app.close();
        }
    });

    it("list route returns only transitive dependencies when dependencyType=transitive", async () => {
        const { app, db, token } = await createTestContext();
        try {
            await insertTestProject(db, "proj-1");

            await db.insert(vulnerabilities).values([
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "lodash",
                    dedupKey: "d1",
                    dependencyKind: "dependency"
                }),
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "transitive-pkg",
                    dedupKey: "d2",
                    dependencyKind: "transitive"
                })
            ]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities?dependencyType=transitive"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.items).toHaveLength(1);
            expect(body.items[0].packageName).toBe("transitive-pkg");
            expect(body.items[0].dependencyKind).toBe("transitive");
        } finally {
            await app.close();
        }
    });

    it("list route returns all when no dependencyType specified", async () => {
        const { app, db, token } = await createTestContext();
        try {
            await insertTestProject(db, "proj-1");

            await db.insert(vulnerabilities).values([
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "lodash",
                    dedupKey: "d1",
                    dependencyKind: "dependency"
                }),
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "transitive-pkg",
                    dedupKey: "d2",
                    dependencyKind: "transitive"
                })
            ]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.items).toHaveLength(2);
        } finally {
            await app.close();
        }
    });

    it("export route filters by dependencyType=direct", async () => {
        const { app, db, token } = await createTestContext();
        try {
            await insertTestProject(db, "proj-1");

            await db.insert(vulnerabilities).values([
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "lodash",
                    dedupKey: "d1",
                    dependencyKind: "dependency"
                }),
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "transitive-pkg",
                    dedupKey: "d2",
                    dependencyKind: "transitive"
                })
            ]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/export?format=json&dependencyType=direct"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body).toHaveLength(1);
            expect(body[0].packageName).toBe("lodash");
        } finally {
            await app.close();
        }
    });

    it("export route filters by dependencyType=transitive", async () => {
        const { app, db, token } = await createTestContext();
        try {
            await insertTestProject(db, "proj-1");

            await db.insert(vulnerabilities).values([
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "lodash",
                    dedupKey: "d1",
                    dependencyKind: "dependency"
                }),
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "transitive-pkg",
                    dedupKey: "d2",
                    dependencyKind: "transitive"
                })
            ]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/export?format=json&dependencyType=transitive"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body).toHaveLength(1);
            expect(body[0].packageName).toBe("transitive-pkg");
        } finally {
            await app.close();
        }
    });

    it("summary route computes transitiveCount and directCount from stored dependencyKind values", async () => {
        const { app, db, token } = await createTestContext();
        try {
            await insertTestProject(db, "proj-1");

            await db.insert(vulnerabilities).values([
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "lodash",
                    dedupKey: "d1",
                    dependencyKind: "dependency"
                }),
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "left-pad",
                    dedupKey: "d2",
                    dependencyKind: "devDependency"
                }),
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "transitive-pkg-1",
                    dedupKey: "d3",
                    dependencyKind: "transitive"
                }),
                makeVulnerability({
                    projectId: "proj-1",
                    packageName: "transitive-pkg-2",
                    dedupKey: "d4",
                    dependencyKind: "transitive"
                })
            ]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.totalVulnerabilities).toBe(4);
            expect(body.transitiveCount).toBe(2);
            expect(body.directCount).toBe(2);
        } finally {
            await app.close();
        }
    });
});
