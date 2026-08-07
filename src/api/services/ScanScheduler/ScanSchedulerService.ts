import { resolve } from "path";
import Bree from "bree";
import { eq } from "drizzle-orm";
import { ScanSchedulerService as Abstraction } from "./abstractions/ScanSchedulerService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EventBus } from "../EventBus/index.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";
import { INTERVAL_MS, type ScanInterval } from "#shared/schedules/types.js";

declare module "../EventBus/index.js" {
    interface IEventMap {
        "scan:completed": [projectId: string];
        "scan:scheduled": [projectId: string];
    }
}

// The worker script is a plain, uncompiled `.js` file — it is never part of
// the tsc program (no `allowJs`) and is never copied into `dist/`. It is
// resolved relative to the process working directory instead of
// `import.meta.url`, mirroring how `runMigrations` locates
// `./src/api/db/migrations` — both read source-tree assets at runtime rather
// than assuming a build step materializes them under `dist/`.
const WORKER_SCRIPT_PATH = resolve(process.cwd(), "src/api/workers/scanWorker.js");

interface IWorkerMessage {
    projectId: string;
}

function isWorkerMessage(message: unknown): message is IWorkerMessage {
    return (
        typeof message === "object" &&
        message !== null &&
        typeof (message as { projectId?: unknown }).projectId === "string"
    );
}

function jobNameForProject(projectId: string): string {
    return `scan-${projectId}`;
}

export class ScanSchedulerServiceImpl implements Abstraction.Interface {
    private bree: Bree | null = null;
    private readonly activeJobs = new Set<string>();

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly eventBus: EventBus.Interface
    ) {
        this.eventBus.on("scan:completed", (projectId: string) => {
            void this.onScanComplete(projectId);
        });
    }

    public async resolveInterval(projectId: string): Promise<ScanInterval> {
        const override = await this.databaseClient.db
            .select({ interval: scanSchedules.interval })
            .from(scanSchedules)
            .where(eq(scanSchedules.projectId, projectId))
            .get();

        if (override) {
            return override.interval as ScanInterval;
        }

        const globalDefault = await this.databaseClient.db
            .select({ value: appSettings.value })
            .from(appSettings)
            .where(eq(appSettings.key, "scan_schedule_default"))
            .get();

        return (globalDefault?.value as ScanInterval | undefined) ?? "disabled";
    }

    public computeNextRunAt(lastRunAt: number | null, intervalMs: number): number {
        const base = lastRunAt ?? Date.now();
        return base + intervalMs;
    }

    public async init(): Promise<void> {
        this.bree = new Bree({
            root: false,
            jobs: [],
            workerMessageHandler: ({ message }) => {
                if (isWorkerMessage(message)) {
                    void this.handleWorkerMessage(message.projectId);
                }
            }
        });

        await this.bree.start();

        const allProjects = await this.databaseClient.db.select().from(projects).all();

        for (let i = 0; i < allProjects.length; i++) {
            const project = allProjects[i]!;
            const interval = await this.resolveInterval(project.id);

            if (interval === "disabled") {
                continue;
            }

            const intervalMs = INTERVAL_MS[interval];
            const scheduleRow = await this.databaseClient.db
                .select()
                .from(scanSchedules)
                .where(eq(scanSchedules.projectId, project.id))
                .get();

            const nextRunAt = scheduleRow?.nextRunAt ?? this.computeNextRunAt(null, intervalMs);
            const now = Date.now();
            const staggerMs = i * 5000;
            const delayMs = Math.max(0, nextRunAt - now) + staggerMs;

            await this.addBreeJob(project.id, intervalMs, delayMs);
        }
    }

    public async stop(): Promise<void> {
        if (this.bree) {
            await this.bree.stop();
            this.bree = null;
        }
        this.activeJobs.clear();
    }

    public async scheduleProject(projectId: string): Promise<void> {
        if (this.activeJobs.has(projectId)) {
            await this.removeBreeJob(projectId);
        }

        const interval = await this.resolveInterval(projectId);
        if (interval === "disabled") {
            return;
        }

        const intervalMs = INTERVAL_MS[interval];
        await this.addBreeJob(projectId, intervalMs, intervalMs);
    }

    public async unscheduleProject(projectId: string): Promise<void> {
        if (this.activeJobs.has(projectId)) {
            await this.removeBreeJob(projectId);
        }
    }

    public async onGlobalDefaultChanged(): Promise<void> {
        const allProjects = await this.databaseClient.db
            .select({ id: projects.id })
            .from(projects)
            .all();
        const overrideProjectIds = new Set(
            (
                await this.databaseClient.db
                    .select({ projectId: scanSchedules.projectId })
                    .from(scanSchedules)
                    .all()
            ).map(row => row.projectId)
        );

        for (const project of allProjects) {
            if (!overrideProjectIds.has(project.id)) {
                await this.scheduleProject(project.id);
            }
        }
    }

    public async onScanComplete(projectId: string): Promise<void> {
        const row = await this.databaseClient.db
            .select()
            .from(scanSchedules)
            .where(eq(scanSchedules.projectId, projectId))
            .get();

        if (!row) {
            return;
        }

        const interval = row.interval as ScanInterval;
        if (interval === "disabled") {
            return;
        }

        const now = Date.now();
        const intervalMs = INTERVAL_MS[interval];
        const nextRunAt = now + intervalMs;

        await this.databaseClient.db
            .update(scanSchedules)
            .set({ lastRunAt: now, nextRunAt, updatedAt: now })
            .where(eq(scanSchedules.projectId, projectId))
            .run();
    }

    private handleWorkerMessage(projectId: string): void {
        this.eventBus.emit("scan:scheduled", projectId);
    }

    private async addBreeJob(
        projectId: string,
        intervalMs: number,
        delayMs: number
    ): Promise<void> {
        if (!this.bree) {
            return;
        }

        const jobName = jobNameForProject(projectId);

        await this.bree.add({
            name: jobName,
            path: WORKER_SCRIPT_PATH,
            interval: intervalMs,
            timeout: delayMs,
            worker: { workerData: { projectId } }
        });

        await this.bree.start(jobName);
        this.activeJobs.add(projectId);
    }

    private async removeBreeJob(projectId: string): Promise<void> {
        if (!this.bree) {
            return;
        }

        const jobName = jobNameForProject(projectId);

        try {
            await this.bree.stop(jobName);
            await this.bree.remove(jobName);
        } catch {
            // Job may not exist — safe to ignore.
        }

        this.activeJobs.delete(projectId);
    }
}

export const ScanSchedulerService = Abstraction.createImplementation({
    implementation: ScanSchedulerServiceImpl,
    dependencies: [DatabaseClient, EventBus]
});
