import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { AutoFixSettingsService as Abstraction } from "./abstractions/AutoFixSettingsService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { autoFixSettings } from "#api/db/schema.js";

const DEFAULTS: Omit<Abstraction.Settings, "id" | "projectId" | "createdAt" | "updatedAt"> = {
    enabled: false,
    upgradeTypes: ["patch"],
    groupingStrategy: "per-package",
    branchPrefix: "auto-fix/"
};

function rowToSettings(row: typeof autoFixSettings.$inferSelect): Abstraction.Settings {
    return {
        id: row.id,
        projectId: row.projectId,
        enabled: row.enabled === 1,
        upgradeTypes: (() => {
            try {
                return JSON.parse(row.upgradeTypes) as string[];
            } catch {
                return ["patch"];
            }
        })(),
        groupingStrategy: row.groupingStrategy,
        branchPrefix: row.branchPrefix,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

export class AutoFixSettingsServiceImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async getSettings(projectId: string): Promise<Abstraction.Settings | null> {
        const row = await this.databaseClient.db
            .select()
            .from(autoFixSettings)
            .where(eq(autoFixSettings.projectId, projectId))
            .get();
        return row ? rowToSettings(row) : null;
    }

    public async getSettingsOrDefaults(projectId: string): Promise<Abstraction.Settings> {
        const existing = await this.getSettings(projectId);
        if (existing) {
            return existing;
        }
        const now = Date.now();
        return {
            id: "",
            projectId,
            ...DEFAULTS,
            createdAt: now,
            updatedAt: now
        };
    }

    public async updateSettings(
        projectId: string,
        input: Abstraction.UpdateInput
    ): Promise<Abstraction.Settings> {
        const existing = await this.getSettings(projectId);
        const now = Date.now();

        if (existing) {
            const updated = {
                enabled:
                    input.enabled !== undefined
                        ? input.enabled
                            ? 1
                            : 0
                        : existing.enabled
                          ? 1
                          : 0,
                upgradeTypes:
                    input.upgradeTypes !== undefined
                        ? JSON.stringify(input.upgradeTypes)
                        : JSON.stringify(existing.upgradeTypes),
                groupingStrategy: input.groupingStrategy ?? existing.groupingStrategy,
                branchPrefix: input.branchPrefix ?? existing.branchPrefix,
                updatedAt: now
            };

            await this.databaseClient.db
                .update(autoFixSettings)
                .set(updated)
                .where(eq(autoFixSettings.projectId, projectId))
                .run();

            return (await this.getSettings(projectId))!;
        }

        const newRow = {
            id: generateId(),
            projectId,
            enabled: input.enabled ? 1 : 0,
            upgradeTypes: JSON.stringify(input.upgradeTypes ?? DEFAULTS.upgradeTypes),
            groupingStrategy: input.groupingStrategy ?? DEFAULTS.groupingStrategy,
            branchPrefix: input.branchPrefix ?? DEFAULTS.branchPrefix,
            createdAt: now,
            updatedAt: now
        };

        await this.databaseClient.db.insert(autoFixSettings).values(newRow).run();
        return (await this.getSettings(projectId))!;
    }
}

export const AutoFixSettingsService = Abstraction.createImplementation({
    implementation: AutoFixSettingsServiceImpl,
    dependencies: [DatabaseClient]
});
