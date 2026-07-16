import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const successResponseSchema = z.object({ success: z.literal(true) });

export const clearCacheRoute = defineRoute({
    method: "DELETE",
    path: "/api/cache",
    description: "Clear the entire registry cache",
    params: z.object({}),
    response: successResponseSchema
});

export const clearPackageCacheRoute = defineRoute({
    method: "DELETE",
    path: "/api/cache/:packageName",
    description: "Clear a single package's registry cache entry",
    params: z.object({ packageName: z.string() }),
    response: successResponseSchema
});
