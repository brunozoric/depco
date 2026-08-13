import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { SCAN_INTERVALS } from "#shared/schedules/types.js";
import {
    listScanSchedulesResponseSchema,
    upsertScanScheduleResponseSchema,
    getScanScheduleDefaultResponseSchema,
    upsertScanScheduleDefaultResponseSchema
} from "../responses/scanSchedules.js";

export const listScanSchedulesRoute = defineRoute({
    method: "GET",
    path: "/api/scan-schedules",
    description: "List resolved scan schedules for all projects",
    params: z.object({}),
    response: listScanSchedulesResponseSchema
});

export const upsertScanScheduleRoute = defineRoute({
    method: "PUT",
    path: "/api/scan-schedules/:projectId",
    description: "Set per-project scan schedule override",
    params: z.object({ projectId: z.string() }),
    body: z.object({ interval: z.enum(SCAN_INTERVALS) }),
    response: upsertScanScheduleResponseSchema
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
    response: getScanScheduleDefaultResponseSchema
});

export const upsertScanScheduleDefaultRoute = defineRoute({
    method: "PUT",
    path: "/api/settings/scan-schedule-default",
    description: "Set global default scan interval",
    params: z.object({}),
    body: z.object({ interval: z.enum(SCAN_INTERVALS) }),
    response: upsertScanScheduleDefaultResponseSchema
});
