import { z } from "zod";
import { generateId, Logger } from "@webiny/stdlib";
import { NodeReleaseDataService as Abstraction } from "./abstractions/NodeReleaseDataService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { nodeReleaseData } from "#api/db/schema.js";
import { NODE_RELEASES } from "#shared/engines/nodeReleases.js";
import type { INodeRelease } from "#shared/engines/types.js";

const NODE_RELEASES_API_URL = "https://endoflife.date/api/nodejs.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const nodeReleaseApiEntrySchema = z.object({
    cycle: z.string(),
    releaseDate: z.string(),
    lts: z.union([z.literal(false), z.string()]),
    maintenance: z.string().optional(),
    eol: z.string(),
    codename: z.string().optional()
});

const nodeReleaseApiResponseSchema = z.array(nodeReleaseApiEntrySchema);

type INodeReleaseApiEntry = z.infer<typeof nodeReleaseApiEntrySchema>;

interface IStoredNodeRelease {
    version: number;
    codename: string | null;
    releaseDate: number;
    ltsStart: number | null;
    maintenanceStart: number | null;
    eolDate: number;
}

function toNodeRelease(row: IStoredNodeRelease): INodeRelease {
    return {
        version: row.version,
        codename: row.codename,
        releaseDate: row.releaseDate,
        ltsStart: row.ltsStart,
        maintenanceStart: row.maintenanceStart,
        eolDate: row.eolDate
    };
}

function byVersionAscending(a: INodeRelease, b: INodeRelease): number {
    return a.version - b.version;
}

/**
 * Converts one endoflife.date API entry into our internal shape. Returns
 * `null` for cycles that aren't a plain major-version integer (e.g. legacy
 * "0.10"/"0.12" entries), since those don't fit the `version: number` model
 * used throughout the rest of the engines feature.
 */
function transformApiEntry(entry: INodeReleaseApiEntry): INodeRelease | null {
    if (!/^\d+$/.test(entry.cycle)) {
        return null;
    }

    return {
        version: Number(entry.cycle),
        codename: entry.codename ? entry.codename : null,
        releaseDate: Date.parse(entry.releaseDate),
        ltsStart: entry.lts === false ? null : Date.parse(entry.lts),
        maintenanceStart: entry.maintenance ? Date.parse(entry.maintenance) : null,
        eolDate: Date.parse(entry.eol)
    };
}

class NodeReleaseDataServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly logger: Logger.Interface
    ) {}

    public async getSchedule(): Promise<INodeRelease[]> {
        const existingRows = await this.databaseClient.db.select().from(nodeReleaseData).all();
        const newestFetchedAt = existingRows.reduce(
            (max, row) => (row.fetchedAt > max ? row.fetchedAt : max),
            0
        );
        const isFresh = existingRows.length > 0 && Date.now() - newestFetchedAt < CACHE_TTL_MS;

        if (isFresh) {
            return existingRows.map(toNodeRelease).sort(byVersionAscending);
        }

        let releases: INodeRelease[];
        try {
            releases = await this.fetchSchedule();
        } catch (error) {
            this.logger.error("Failed to fetch Node.js release schedule", {
                error: String(error)
            });
            if (existingRows.length > 0) {
                return existingRows.map(toNodeRelease).sort(byVersionAscending);
            }
            return NODE_RELEASES;
        }

        try {
            await this.upsertReleases(releases);
        } catch (error) {
            this.logger.error("Failed to persist Node.js release schedule to database", {
                error: String(error)
            });
        }

        return releases;
    }

    private async fetchSchedule(): Promise<INodeRelease[]> {
        const response = await fetch(NODE_RELEASES_API_URL);
        if (!response.ok) {
            throw new Error(`Node.js release API responded with status ${response.status}`);
        }

        const json: unknown = await response.json();
        const parsed = nodeReleaseApiResponseSchema.parse(json);

        const releases: INodeRelease[] = [];
        for (const entry of parsed) {
            const release = transformApiEntry(entry);
            if (release) {
                releases.push(release);
            }
        }
        return releases;
    }

    private async upsertReleases(releases: INodeRelease[]): Promise<void> {
        const fetchedAt = Date.now();
        for (const release of releases) {
            await this.databaseClient.db
                .insert(nodeReleaseData)
                .values({
                    id: generateId(),
                    version: release.version,
                    codename: release.codename,
                    releaseDate: release.releaseDate,
                    ltsStart: release.ltsStart,
                    maintenanceStart: release.maintenanceStart,
                    eolDate: release.eolDate,
                    fetchedAt
                })
                .onConflictDoUpdate({
                    target: nodeReleaseData.version,
                    set: {
                        codename: release.codename,
                        releaseDate: release.releaseDate,
                        ltsStart: release.ltsStart,
                        maintenanceStart: release.maintenanceStart,
                        eolDate: release.eolDate,
                        fetchedAt
                    }
                })
                .run();
        }
    }
}

export const NodeReleaseDataService = Abstraction.createImplementation({
    implementation: NodeReleaseDataServiceImpl,
    dependencies: [DatabaseClient, Logger]
});
