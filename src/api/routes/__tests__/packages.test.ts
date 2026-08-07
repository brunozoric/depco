import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EmailService } from "../../services/Email/index.js";
import { UserService as UserServiceRegistration } from "../../services/UserService.js";
import { AuthService as AuthServiceRegistration } from "../../services/AuthService.js";
import { createAuthHook } from "../../middleware/authHook.js";
import { generateId } from "@webiny/stdlib";
import {
    projects,
    scanResults,
    dependencies,
    dependencyVersions,
    changelogs,
    teams,
    teamProjects
} from "#api/db/schema.js";
import { packagesRoutes } from "../packages.js";
import { RegistryCacheService } from "../../services/abstractions/RegistryCacheService.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function insertProject(db: TestDb, name: string): Promise<string> {
    const id = generateId();
    await db
        .insert(projects)
        .values({
            id,
            name,
            path: `/tmp/${name}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now(),
            lastScannedAt: null
        })
        .run();
    return id;
}

interface IInsertScanResultRow {
    projectId: string;
    name: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: string;
    dependencyKind?: string;
    registryResolved?: boolean;
}

async function insertScanResult(db: TestDb, row: IInsertScanResultRow): Promise<void> {
    await db
        .insert(scanResults)
        .values({
            id: generateId(),
            projectId: row.projectId,
            name: row.name,
            currentVersion: row.currentVersion,
            latestVersion: row.latestVersion,
            latestInRange: row.currentVersion,
            type: "dependency",
            upgradeType: row.upgradeType,
            dependencyKind: row.dependencyKind ?? "dependency",
            registryResolved: row.registryResolved === false ? 0 : 1,
            scannedAt: Date.now()
        })
        .run();
}

async function insertChangelog(db: TestDb, packageName: string, version: string): Promise<void> {
    const depId = generateId();
    await db
        .insert(dependencies)
        .values({
            id: depId,
            name: packageName,
            repoUrl: null,
            createdAt: Date.now()
        })
        .run();

    const versionId = generateId();
    await db
        .insert(dependencyVersions)
        .values({
            id: versionId,
            dependencyId: depId,
            version,
            publishedAt: null
        })
        .run();

    await db
        .insert(changelogs)
        .values({
            id: generateId(),
            dependencyId: depId,
            dependencyVersionId: versionId,
            content: "## Changes",
            source: "github",
            fetchedAt: Date.now()
        })
        .run();
}

describe("packages routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let token: string;

    beforeEach(async () => {
        db = await createTestDb();

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(RegistryCacheService, {
            getPackageInfo: async () => ({
                name: "",
                latestVersion: "",
                distTags: {},
                versions: [],
                time: {},
                repoUrl: null,
                repoDirectory: null,
                readme: null,
                license: null
            }),
            clearAll: async () => {},
            clearPackage: async () => {}
        });
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(packagesRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    it("returns empty list when there are no scan results", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toEqual([]);
        expect(json.total).toBe(0);
    });

    it("aggregates a package shared across multiple projects into one item", async () => {
        const projectAId = await insertProject(db, "project-a");
        const projectBId = await insertProject(db, "project-b");

        await insertScanResult(db, {
            projectId: projectAId,
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor"
        });
        await insertScanResult(db, {
            projectId: projectBId,
            name: "react",
            currentVersion: "17.0.0",
            latestVersion: "18.2.0",
            upgradeType: "major"
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.total).toBe(1);
        expect(json.items).toHaveLength(1);
        expect(json.items[0].name).toBe("react");
        expect(json.items[0].changelogCount).toBe(0);
        expect(json.items[0].projects).toHaveLength(2);

        const byProjectId = Object.fromEntries(
            json.items[0].projects.map((p: { projectId: string }) => [p.projectId, p])
        );
        expect(byProjectId[projectAId]).toEqual({
            projectId: projectAId,
            projectName: "project-a",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor"
        });
        expect(byProjectId[projectBId]).toEqual({
            projectId: projectBId,
            projectName: "project-b",
            currentVersion: "17.0.0",
            latestVersion: "18.2.0",
            upgradeType: "major"
        });
    });

    it("returns dependencyKind and registryResolved=true when every occurrence is resolved", async () => {
        const projectId = await insertProject(db, "project-a");
        await insertScanResult(db, {
            projectId,
            name: "left-pad",
            currentVersion: "1.0.0",
            latestVersion: "1.0.0",
            upgradeType: "none",
            dependencyKind: "transitive",
            registryResolved: true
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items[0].dependencyKind).toBe("transitive");
        expect(json.items[0].registryResolved).toBe(true);
    });

    it("returns registryResolved=false when any occurrence across projects is unresolved", async () => {
        const projectAId = await insertProject(db, "project-a");
        const projectBId = await insertProject(db, "project-b");
        await insertScanResult(db, {
            projectId: projectAId,
            name: "left-pad",
            currentVersion: "1.0.0",
            latestVersion: "1.0.0",
            upgradeType: "none",
            registryResolved: true
        });
        await insertScanResult(db, {
            projectId: projectBId,
            name: "left-pad",
            currentVersion: "1.0.0",
            latestVersion: "1.0.0",
            upgradeType: "none",
            registryResolved: false
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items[0].registryResolved).toBe(false);
    });

    it("filters by search", async () => {
        const projectId = await insertProject(db, "project-a");
        await insertScanResult(db, {
            projectId,
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor"
        });
        await insertScanResult(db, {
            projectId,
            name: "lodash",
            currentVersion: "4.0.0",
            latestVersion: "4.1.0",
            upgradeType: "patch"
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages?search=rea"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].name).toBe("react");
    });

    it("filters by upgradeType", async () => {
        const projectId = await insertProject(db, "project-a");
        await insertScanResult(db, {
            projectId,
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor"
        });
        await insertScanResult(db, {
            projectId,
            name: "lodash",
            currentVersion: "4.0.0",
            latestVersion: "4.1.0",
            upgradeType: "patch"
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages?upgradeType=patch"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].name).toBe("lodash");
    });

    it("filters by dependencyKind", async () => {
        const projectId = await insertProject(db, "project-a");
        await insertScanResult(db, {
            projectId,
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor",
            dependencyKind: "dependency"
        });
        await insertScanResult(db, {
            projectId,
            name: "lodash",
            currentVersion: "4.0.0",
            latestVersion: "4.1.0",
            upgradeType: "patch",
            dependencyKind: "transitive"
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages?dependencyKind=transitive"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].name).toBe("lodash");
    });

    it("returns all dependency kinds when dependencyKind=all", async () => {
        const projectId = await insertProject(db, "project-a");
        await insertScanResult(db, {
            projectId,
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor",
            dependencyKind: "dependency"
        });
        await insertScanResult(db, {
            projectId,
            name: "lodash",
            currentVersion: "4.0.0",
            latestVersion: "4.1.0",
            upgradeType: "patch",
            dependencyKind: "transitive"
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages?dependencyKind=all"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(2);
    });

    it("filters by projectId", async () => {
        const projectAId = await insertProject(db, "project-a");
        const projectBId = await insertProject(db, "project-b");
        await insertScanResult(db, {
            projectId: projectAId,
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor"
        });
        await insertScanResult(db, {
            projectId: projectBId,
            name: "lodash",
            currentVersion: "4.0.0",
            latestVersion: "4.1.0",
            upgradeType: "patch"
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/packages?projectId=${projectAId}`
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].name).toBe("react");
    });

    it("filters by teamId", async () => {
        const projectAId = await insertProject(db, "project-a");
        const projectBId = await insertProject(db, "project-b");
        await insertScanResult(db, {
            projectId: projectAId,
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor"
        });
        await insertScanResult(db, {
            projectId: projectBId,
            name: "lodash",
            currentVersion: "4.0.0",
            latestVersion: "4.1.0",
            upgradeType: "patch"
        });

        const teamId = generateId();
        await db
            .insert(teams)
            .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
            .run();
        await db
            .insert(teamProjects)
            .values({ id: generateId(), teamId, projectId: projectAId })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/packages?teamId=${teamId}`
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].name).toBe("react");
    });

    it("filters by hasChangelog", async () => {
        const projectId = await insertProject(db, "project-a");
        await insertScanResult(db, {
            projectId,
            name: "react",
            currentVersion: "18.0.0",
            latestVersion: "18.2.0",
            upgradeType: "minor"
        });
        await insertScanResult(db, {
            projectId,
            name: "lodash",
            currentVersion: "4.0.0",
            latestVersion: "4.1.0",
            upgradeType: "patch"
        });

        await insertChangelog(db, "react", "18.2.0");

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/packages?hasChangelog=true"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].name).toBe("react");
        expect(json.items[0].changelogCount).toBe(1);
    });
});
