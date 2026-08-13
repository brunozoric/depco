import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { successResponseSchema } from "../responses/cache.js";

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
