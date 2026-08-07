import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { DatabaseClient as DatabaseClientAbstraction } from "#api/db/abstractions/DatabaseClient.js";
import { SbomService as SbomServiceRegistration } from "../../services/Sbom/SbomService.js";
import { SbomFormatterRegistry as SbomFormatterRegistryRegistration } from "../../services/Sbom/SbomFormatterRegistry.js";
import { CycloneDxFormatter as CycloneDxFormatterRegistration } from "../../services/Sbom/formatters/CycloneDxFormatter.js";
import { SpdxFormatter as SpdxFormatterRegistration } from "../../services/Sbom/formatters/SpdxFormatter.js";
import { projects, scanResults } from "#api/db/schema.js";
import { sbomRoutes } from "../sbom.js";
import { createContainer } from "#shared/index.js";

describe("sbom routes", () => {
    let app: FastifyInstance;
    let databaseClient: DatabaseClient.Interface;

    beforeEach(async () => {
        databaseClient = await createTestDatabaseClient();
        const container = createContainer();
        container.registerInstance(DatabaseClientAbstraction, databaseClient);
        container.register(SbomServiceRegistration);
        container.register(CycloneDxFormatterRegistration);
        container.register(SpdxFormatterRegistration);
        container.register(SbomFormatterRegistryRegistration);

        app = Fastify();
        await app.register(sbomRoutes, { container });
        await app.ready();
    });

    async function seedProject(id: string, name: string): Promise<void> {
        await databaseClient.db
            .insert(projects)
            .values({
                id,
                name,
                path: `/projects/${name}`,
                addedAt: Date.now(),
                packageManager: "yarn"
            })
            .run();
    }

    async function seedScanResult(projectId: string, packageName: string): Promise<void> {
        await databaseClient.db
            .insert(scanResults)
            .values({
                id: generateId(),
                projectId,
                name: packageName,
                currentVersion: "1.0.0",
                latestVersion: "1.0.0",
                latestInRange: "1.0.0",
                type: "dependency",
                upgradeType: "none",
                scannedAt: Date.now()
            })
            .run();
    }

    describe("GET /api/sbom/:projectId", () => {
        it("returns CycloneDX SBOM for a project", async () => {
            await seedProject("p1", "my-app");
            await seedScanResult("p1", "lodash");

            const response = await app.inject({
                method: "GET",
                url: "/api/sbom/p1?format=cyclonedx"
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers["content-type"]).toBe("application/json");
            expect(response.headers["content-disposition"]).toContain("my-app-cyclonedx.json");

            const body = JSON.parse(response.body);
            expect(body.bomFormat).toBe("CycloneDX");
        });

        it("returns SPDX SBOM for a project", async () => {
            await seedProject("p1", "my-app");

            const response = await app.inject({
                method: "GET",
                url: "/api/sbom/p1?format=spdx"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.spdxVersion).toBe("SPDX-2.3");
        });

        it("defaults to CycloneDX when no format specified", async () => {
            await seedProject("p1", "my-app");

            const response = await app.inject({
                method: "GET",
                url: "/api/sbom/p1"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.bomFormat).toBe("CycloneDX");
        });

        it("returns 404 for unknown project", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/api/sbom/nonexistent"
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe("GET /api/sbom", () => {
        it("returns aggregate SBOM across all projects", async () => {
            await seedProject("p1", "app-a");
            await seedProject("p2", "app-b");
            await seedScanResult("p1", "lodash");
            await seedScanResult("p2", "axios");

            const response = await app.inject({
                method: "GET",
                url: "/api/sbom?format=cyclonedx"
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers["content-disposition"]).toContain(
                "all-projects-cyclonedx.json"
            );

            const body = JSON.parse(response.body);
            expect(body.components).toHaveLength(2);
        });
    });
});
