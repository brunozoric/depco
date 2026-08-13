import { projectStepHooks } from "#api/db/schema.js";

export interface IStepHookResponse {
    id: string;
    projectId: string;
    position: string;
    name: string;
    command: string;
    type: "command" | "script" | "package-script";
    required: boolean;
    enabled: boolean;
    sortOrder: number;
    source: "db" | "file" | "package-json";
    createdAt: number;
    updatedAt: number;
}

export function toStepHookResponse(row: typeof projectStepHooks.$inferSelect): IStepHookResponse {
    return {
        id: row.id,
        projectId: row.projectId,
        position: row.position,
        name: row.name,
        command: row.command,
        type: row.type as IStepHookResponse["type"],
        required: row.required === 1,
        enabled: row.enabled === 1,
        sortOrder: row.sortOrder,
        source: row.source as IStepHookResponse["source"],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}
