import { describe, it, expect } from "vitest";
import {
    createTestContext,
    seedVulnerabilities,
    seedVulnerabilitiesAcrossProjects,
    seedVulnerabilitiesWithSeverities
} from "./vulnerabilities.testHelpers.js";

describe("vulnerability routes", () => {
    describe("PATCH /api/vulnerabilities/bulk", () => {
        it("dismisses selected vulnerabilities", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 3);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: [vulnerabilityIds[0], vulnerabilityIds[1]], action: "dismiss" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().updatedCount).toBe(2);

            await testApp.close();
        });

        it("snoozes with required snoozeDays", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 2);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: [vulnerabilityIds[0]], action: "snooze", snoozeDays: 30 }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().updatedCount).toBe(1);

            await testApp.close();
        });

        it("rejects snooze without snoozeDays", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 1);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: [vulnerabilityIds[0]], action: "snooze" }
            });

            expect(response.statusCode).toBe(400);

            await testApp.close();
        });

        it("rejects empty ids array", async () => {
            const { app: testApp, token: testToken } = await createTestContext();

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: [], action: "dismiss" }
            });

            expect(response.statusCode).toBe(400);

            await testApp.close();
        });

        it("undismisses selected vulnerabilities", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 2);
            await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: vulnerabilityIds, action: "dismiss" }
            });

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: vulnerabilityIds, action: "undismiss" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().updatedCount).toBe(2);

            await testApp.close();
        });
    });

    describe("POST /api/vulnerabilities/bulk/rescan", () => {
        it("queues scans for unique projects of selected vulnerabilities", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilitiesAcrossProjects(db, {
                "project-1": 2,
                "project-2": 1
            });

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "POST",
                url: "/api/vulnerabilities/bulk/rescan",
                payload: { ids: vulnerabilityIds }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().projectsQueued).toBe(2);

            await testApp.close();
        });

        it("rejects an empty ids array", async () => {
            const { app: testApp, token: testToken } = await createTestContext();

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "POST",
                url: "/api/vulnerabilities/bulk/rescan",
                payload: { ids: [] }
            });

            expect(response.statusCode).toBe(400);

            await testApp.close();
        });
    });

    describe("GET /api/vulnerabilities/export", () => {
        it("exports as JSON with correct content-disposition", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            await seedVulnerabilities(db, 3);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: "/api/vulnerabilities/export?format=json"
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers["content-disposition"]).toContain("attachment");
            expect(response.headers["content-type"]).toContain("application/json");
            const data = response.json();
            expect(data).toHaveLength(3);

            await testApp.close();
        });

        it("exports as CSV with header row and quoted fields", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            await seedVulnerabilities(db, 2);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: "/api/vulnerabilities/export?format=csv"
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers["content-disposition"]).toContain("attachment");
            expect(response.headers["content-type"]).toContain("text/csv");
            const lines = response.body.split("\n").filter(Boolean);
            expect(lines[0]).toContain("packageName");
            expect(lines[0]).toContain("dependencyKind");
            expect(lines).toHaveLength(3); // header + 2 rows

            await testApp.close();
        });

        it("exports only selected ids when ids param provided", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 5);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: `/api/vulnerabilities/export?format=json&ids=${vulnerabilityIds[0]},${vulnerabilityIds[1]}`
            });

            expect(response.json()).toHaveLength(2);

            await testApp.close();
        });

        it("applies filters to export", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            await seedVulnerabilitiesWithSeverities(db, { critical: 2, low: 3 });

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: "/api/vulnerabilities/export?format=json&severity=critical"
            });

            expect(response.json()).toHaveLength(2);

            await testApp.close();
        });
    });
});
