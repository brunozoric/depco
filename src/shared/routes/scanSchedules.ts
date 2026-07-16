import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { SCAN_INTERVALS } from "#shared/schedules/types.js";

const scanScheduleSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    interval: z.string(),
    lastRunAt: z.number().nullable(),
    nextRunAt: z.number().nullable(),
    enabled: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number()
});

const resolvedScheduleSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    interval: z.string(),
    source: z.enum(["project", "default"]),
    lastRunAt: z.number().nullable(),
    nextRunAt: z.number().nullable()
});

export const listScanSchedulesRoute = defineRoute({
    method: "GET",
    path: "/api/scan-schedules",
    description: "List resolved scan schedules for all projects",
    params: z.object({}),
    response: z.object({
        items: z.array(resolvedScheduleSchema),
        globalDefault: z.string()
    })
});

export const upsertScanScheduleRoute = defineRoute({
    method: "PUT",
    path: "/api/scan-schedules/:projectId",
    description: "Set per-project scan schedule override",
    params: z.object({ projectId: z.string() }),
    body: z.object({ interval: z.enum(SCAN_INTERVALS) }),
    response: z.object({ item: scanScheduleSchema })
});

export const deleteScanScheduleRoute = defineRoute({
    method: "DELETE",
    path: "/api/scan-schedules/:projectId",
    description: "Remove per-project schedule override, revert to default",
    params: z.object({ projectId: z.string() })
});

export const getScanScheduleDefaultRoute = defineRoute({
    method: "GET",
    path: "/api/settings/scan-schedule-default",
    description: "Get global default scan interval",
    params: z.object({}),
    response: z.object({ item: z.object({ interval: z.string() }) })
});

export const upsertScanScheduleDefaultRoute = defineRoute({
    method: "PUT",
    path: "/api/settings/scan-schedule-default",
    description: "Set global default scan interval",
    params: z.object({}),
    body: z.object({ interval: z.enum(SCAN_INTERVALS) }),
    response: z.object({ item: z.object({ interval: z.string() }) })
});
