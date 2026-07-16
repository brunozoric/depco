import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { AppLogService as Abstraction } from "./abstractions/AppLogService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { FileConfigService } from "./abstractions/FileConfigService.js";
import { appLogs, appSettings } from "#api/db/schema.js";

const LEVEL_PRIORITY: Record<string, number> = {
    error: 3,
    warn: 2,
    info: 1
};

class AppLogServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
        private readonly fileConfigService: FileConfigService.Interface
    ) {}

    public async log(
        level: Abstraction.Level,
        source: string,
        projectId: string | null,
        message: string,
        details?: string
    ): Promise<void> {
        const threshold = await this.getLogLevel();
        const thresholdPriority = LEVEL_PRIORITY[threshold] ?? 2;
        const entryPriority = LEVEL_PRIORITY[level] ?? 1;

        if (entryPriority < thresholdPriority) {
            return;
        }

        const id = generateId();
        const createdAt = Date.now();

        await this.databaseClient.db
            .insert(appLogs)
            .values({
                id,
                level,
                source,
                projectId,
                message,
                details: details ?? null,
                createdAt
            })
            .run();

        this.webSocketBroadcaster.broadcast("log:created", {
            id,
            level,
            source,
            projectId,
            message,
            createdAt
        });
    }

    private async getLogLevel(): Promise<string> {
        const fileSettingsResult = await this.fileConfigService.readGlobalSettings();
        if (fileSettingsResult.settings?.logLevel) {
            return fileSettingsResult.settings.logLevel;
        }

        const row = await this.databaseClient.db
            .select()
            .from(appSettings)
            .where(eq(appSettings.key, "log_level"))
            .get();

        return row?.value ?? "warn";
    }
}

export const AppLogService = Abstraction.createImplementation({
    implementation: AppLogServiceImpl,
    dependencies: [DatabaseClient, WebSocketBroadcaster, FileConfigService]
});
