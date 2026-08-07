import { eq } from "drizzle-orm";
import { SbomService as Abstraction } from "./abstractions/SbomService.js";
import type { DependencyKind } from "../Scan/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import {
    projects,
    scanResults,
    licenses,
    vulnerabilities,
    dependencyEdges
} from "#api/db/schema.js";

interface ILicenseInfo {
    spdxId: string | null;
    licenseName: string;
}

class SbomServiceImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async collectForProject(projectId: string): Promise<Abstraction.ProjectData> {
        const { db } = this.databaseClient;

        const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

        if (!project) {
            return {
                projectName: "unknown",
                projectPath: "",
                packageManager: null,
                components: [],
                vulnerabilities: [],
                edges: []
            };
        }

        const [componentRows, vulnerabilityRows, edgeRows] = await Promise.all([
            this.collectComponents(projectId),
            this.collectVulnerabilities(projectId),
            this.collectEdges(projectId)
        ]);

        return {
            projectName: project.name,
            projectPath: project.path,
            packageManager: project.packageManager,
            components: componentRows,
            vulnerabilities: vulnerabilityRows,
            edges: edgeRows
        };
    }

    public async collectForAllProjects(): Promise<Abstraction.ProjectData> {
        const allProjects = await this.databaseClient.db.select().from(projects).all();

        const allData = await Promise.all(
            allProjects.map(project => this.collectForProject(project.id))
        );

        const componentMap = new Map<string, Abstraction.Component>();
        const vulnerabilityMap = new Map<string, Abstraction.Vulnerability>();
        const edgeMap = new Map<string, Abstraction.DependencyEdge>();

        for (const data of allData) {
            for (const component of data.components) {
                const key = `${component.packageName}@${component.version}`;
                if (!componentMap.has(key)) {
                    componentMap.set(key, component);
                }
            }
            for (const vulnerability of data.vulnerabilities) {
                const key = `${vulnerability.advisoryId}::${vulnerability.packageName}`;
                if (!vulnerabilityMap.has(key)) {
                    vulnerabilityMap.set(key, vulnerability);
                }
            }
            for (const edge of data.edges) {
                const parent =
                    edge.parentPackage !== null
                        ? `${edge.parentPackage}@${edge.parentVersion ?? "0.0.0"}`
                        : "<root>";
                const edgeKey = `${parent}::${edge.childPackage}@${edge.childVersion}`;
                if (!edgeMap.has(edgeKey)) {
                    edgeMap.set(edgeKey, edge);
                }
            }
        }

        return {
            projectName: "all-projects",
            projectPath: "",
            packageManager: null,
            components: [...componentMap.values()],
            vulnerabilities: [...vulnerabilityMap.values()],
            edges: [...edgeMap.values()]
        };
    }

    private async collectComponents(projectId: string): Promise<Abstraction.Component[]> {
        const { db } = this.databaseClient;

        const licenseMap = new Map<string, ILicenseInfo>();
        const licenseRows = await db
            .select()
            .from(licenses)
            .where(eq(licenses.projectId, projectId))
            .all();
        for (const row of licenseRows) {
            licenseMap.set(row.packageName, { spdxId: row.spdxId, licenseName: row.licenseName });
        }

        const scans = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, projectId))
            .all();

        return scans.map(scan => {
            const licenseInfo = licenseMap.get(scan.name);
            return {
                packageName: scan.name,
                version: scan.currentVersion,
                spdxId: licenseInfo?.spdxId ?? null,
                licenseName: licenseInfo?.licenseName ?? null,
                type: scan.type as DependencyKind
            };
        });
    }

    private async collectVulnerabilities(projectId: string): Promise<Abstraction.Vulnerability[]> {
        const rows = await this.databaseClient.db
            .select()
            .from(vulnerabilities)
            .where(eq(vulnerabilities.projectId, projectId))
            .all();

        return rows.map(row => ({
            advisoryId: row.dedupKey,
            severity: row.severity,
            packageName: row.packageName,
            source: row.source,
            advisoryUrl: row.advisoryUrl
        }));
    }

    private async collectEdges(projectId: string): Promise<Abstraction.DependencyEdge[]> {
        const rows = await this.databaseClient.db
            .select()
            .from(dependencyEdges)
            .where(eq(dependencyEdges.projectId, projectId))
            .all();

        return rows.map(row => ({
            parentPackage: row.parentPackage,
            parentVersion: row.parentVersion,
            childPackage: row.childPackage,
            childVersion: row.childVersion
        }));
    }
}

export const SbomService = Abstraction.createImplementation({
    implementation: SbomServiceImpl,
    dependencies: [DatabaseClient]
});
