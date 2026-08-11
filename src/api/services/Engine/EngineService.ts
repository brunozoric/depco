import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { and, eq, inArray, lt } from "drizzle-orm";
import { generateId, Logger } from "@webiny/stdlib";
import { EngineService as Abstraction } from "./abstractions/EngineService.js";
import { NodeReleaseDataService } from "./abstractions/NodeReleaseDataService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { engineChecks, projects } from "#api/db/schema.js";
import {
    parseEnginesNode,
    classifyNodeVersion,
    walkNodeModules as walkNodeModulesShared
} from "#shared/engines/index.js";
import type { INodeModulesPackageEntry } from "#shared/engines/index.js";
import type { EngineStatus, IEngineStatusCounts, INodeRelease } from "#shared/engines/types.js";

/** The project's own package.json is stored alongside its dependencies using an empty packageName. */
const ROOT_PACKAGE_NAME = "";

const packageJsonEnginesSchema = z.object({
    engines: z
        .object({
            node: z.string().optional()
        })
        .optional()
});

interface IClassifyEntryInput {
    entry: INodeModulesPackageEntry;
    schedule: INodeRelease[];
}

function classifyEntry(input: IClassifyEntryInput): Abstraction.Check {
    const { entry, schedule } = input;
    const minimumMajor = entry.enginesNode ? parseEnginesNode(entry.enginesNode) : null;

    if (minimumMajor === null) {
        return {
            id: "",
            projectId: "",
            packageName: entry.packageName,
            enginesNode: entry.enginesNode,
            minimumMajor: null,
            status: "unknown",
            eolDate: null,
            scannedAt: 0
        };
    }

    const classification = classifyNodeVersion({ majorVersion: minimumMajor, schedule });
    return {
        id: "",
        projectId: "",
        packageName: entry.packageName,
        enginesNode: entry.enginesNode,
        minimumMajor,
        status: classification.status,
        eolDate: classification.eolDate,
        scannedAt: 0
    };
}

function computeStatusCounts(statuses: EngineStatus[]): IEngineStatusCounts {
    const counts: IEngineStatusCounts = {
        eol: 0,
        maintenance: 0,
        activeLts: 0,
        current: 0,
        unknown: 0
    };
    for (const status of statuses) {
        if (status === "active-lts") {
            counts.activeLts += 1;
        } else {
            counts[status] += 1;
        }
    }
    return counts;
}

function toEngineCheck(row: typeof engineChecks.$inferSelect): Abstraction.Check {
    return {
        id: row.id,
        projectId: row.projectId,
        packageName: row.packageName,
        enginesNode: row.enginesNode,
        minimumMajor: row.minimumMajor,
        status: row.status as EngineStatus,
        eolDate: row.eolDate,
        scannedAt: row.scannedAt
    };
}

class EngineServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly nodeReleaseDataService: NodeReleaseDataService.Interface,
        private readonly logger: Logger.Interface
    ) {}

    public async scan(input: Abstraction.ScanInput): Promise<Abstraction.ScanResult> {
        const { projectId, projectPath } = input;
        const schedule = await this.nodeReleaseDataService.getSchedule();

        const entriesByPackageName = walkNodeModulesShared({
            nodeModulesPath: join(projectPath, "node_modules"),
            onMalformedPackage: ({ packageName, error }) => {
                this.logger.warn("Failed to read engines.node for package during engine scan", {
                    packageName,
                    error: String(error)
                });
            }
        });
        entriesByPackageName.set(ROOT_PACKAGE_NAME, {
            packageName: ROOT_PACKAGE_NAME,
            enginesNode: this.readRootEnginesNode(projectPath)
        });

        const priorScannedAtRows = await this.databaseClient.db
            .select({ scannedAt: engineChecks.scannedAt })
            .from(engineChecks)
            .where(eq(engineChecks.projectId, projectId))
            .all();
        const priorMaxScannedAt = priorScannedAtRows.reduce(
            (max, row) => (row.scannedAt > max ? row.scannedAt : max),
            0
        );
        const scannedAt = Math.max(Date.now(), priorMaxScannedAt + 1);

        const records: Abstraction.Check[] = Array.from(entriesByPackageName.values()).map(
            entry => {
                const classified = classifyEntry({ entry, schedule });
                return {
                    ...classified,
                    id: generateId(),
                    projectId,
                    scannedAt
                };
            }
        );

        this.databaseClient.db.transaction(tx => {
            for (const record of records) {
                tx.insert(engineChecks)
                    .values(record)
                    .onConflictDoUpdate({
                        target: [engineChecks.projectId, engineChecks.packageName],
                        set: {
                            enginesNode: record.enginesNode,
                            minimumMajor: record.minimumMajor,
                            status: record.status,
                            eolDate: record.eolDate,
                            scannedAt: record.scannedAt
                        }
                    })
                    .run();
            }
            tx.delete(engineChecks)
                .where(
                    and(
                        eq(engineChecks.projectId, projectId),
                        lt(engineChecks.scannedAt, scannedAt)
                    )
                )
                .run();
        });

        const rootRecord = records.find(record => record.packageName === ROOT_PACKAGE_NAME)!;
        const findings = records.filter(record => record.packageName !== ROOT_PACKAGE_NAME);
        const summary = await this.getSummary();

        return {
            rootStatus: rootRecord.status,
            rootEnginesNode: rootRecord.enginesNode,
            findings,
            summary
        };
    }

    public async getByProject(projectId: string): Promise<Abstraction.Check[]> {
        const rows = await this.databaseClient.db
            .select()
            .from(engineChecks)
            .where(eq(engineChecks.projectId, projectId))
            .all();
        return rows.map(toEngineCheck);
    }

    public async getSummary(options?: Abstraction.GetSummaryOptions): Promise<Abstraction.Summary> {
        const conditions = [];
        if (options?.projectIds && options.projectIds.length > 0) {
            conditions.push(inArray(engineChecks.projectId, options.projectIds));
        }
        const allChecks =
            conditions.length > 0
                ? await this.databaseClient.db
                      .select()
                      .from(engineChecks)
                      .where(and(...conditions))
                      .all()
                : await this.databaseClient.db.select().from(engineChecks).all();

        const projectRows = await this.databaseClient.db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .all();
        const projectNameById = new Map(projectRows.map(row => [row.id, row.name]));

        interface IProjectAccumulator {
            rootStatus: EngineStatus;
            rootEnginesNode: string | null;
            dependencyStatuses: EngineStatus[];
        }

        const dataByProject = new Map<string, IProjectAccumulator>();
        for (const row of allChecks) {
            const existing = dataByProject.get(row.projectId) ?? {
                rootStatus: "unknown",
                rootEnginesNode: null,
                dependencyStatuses: []
            };
            if (row.packageName === ROOT_PACKAGE_NAME) {
                existing.rootStatus = row.status as EngineStatus;
                existing.rootEnginesNode = row.enginesNode;
            } else {
                existing.dependencyStatuses.push(row.status as EngineStatus);
            }
            dataByProject.set(row.projectId, existing);
        }

        const projectSummaries: Abstraction.ProjectSummary[] = Array.from(
            dataByProject.entries()
        ).map(([projectId, data]) => ({
            projectId,
            projectName: projectNameById.get(projectId) ?? projectId,
            rootStatus: data.rootStatus,
            rootEnginesNode: data.rootEnginesNode,
            dependencyCounts: computeStatusCounts(data.dependencyStatuses)
        }));

        const allDependencyStatuses = Array.from(dataByProject.values()).flatMap(
            data => data.dependencyStatuses
        );

        return {
            totalProjects: projectSummaries.length,
            counts: computeStatusCounts(allDependencyStatuses),
            projectSummaries
        };
    }

    private readRootEnginesNode(projectPath: string): string | null {
        try {
            const raw = readFileSync(join(projectPath, "package.json"), "utf-8");
            const parsed = packageJsonEnginesSchema.parse(JSON.parse(raw));
            return parsed.engines?.node ?? null;
        } catch (error) {
            this.logger.warn("Failed to read root package.json during engine scan", {
                projectPath,
                error: String(error)
            });
            return null;
        }
    }
}

export const EngineService = Abstraction.createImplementation({
    implementation: EngineServiceImpl,
    dependencies: [DatabaseClient, NodeReleaseDataService, Logger]
});
