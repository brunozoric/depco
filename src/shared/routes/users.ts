import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { userResponseSchema, userPermissionSchema } from "#shared/users/index.js";

export const listUsersRoute = defineRoute({
    method: "GET",
    path: "/api/users",
    description: "List users",
    params: z.object({}),
    querystring: z.object({
        search: z.string().optional(),
        isActive: z.coerce.boolean().optional(),
        page: z.coerce.number().int().positive().optional().default(1),
        pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
        sortBy: z.enum(["email", "displayName", "createdAt"]).optional().default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc")
    }),
    response: z.object({ items: z.array(userResponseSchema), total: z.number() })
});

export const getUserRoute = defineRoute({
    method: "GET",
    path: "/api/users/:id",
    description: "Get a user",
    params: z.object({ id: z.string() }),
    response: z.object({ item: userResponseSchema })
});

export const createUserRoute = defineRoute({
    method: "POST",
    path: "/api/users",
    description: "Create a user",
    params: z.object({}),
    body: z.object({
        email: z.string().email(),
        displayName: z.string().min(1),
        password: z.string().min(8),
        permission: userPermissionSchema
    }),
    response: z.object({ item: userResponseSchema })
});

export const updateUserRoute = defineRoute({
    method: "PUT",
    path: "/api/users/:id",
    description: "Update a user",
    params: z.object({ id: z.string() }),
    body: z.object({
        displayName: z.string().min(1).optional(),
        password: z.string().min(8).optional(),
        permission: userPermissionSchema.optional(),
        isActive: z.boolean().optional()
    }),
    response: z.object({ item: userResponseSchema })
});

export const deleteUserRoute = defineRoute({
    method: "DELETE",
    path: "/api/users/:id",
    description: "Deactivate a user",
    params: z.object({ id: z.string() })
});

export const forceLogoutUserRoute = defineRoute({
    method: "POST",
    path: "/api/users/:id/force-logout",
    description: "Force logout a user",
    params: z.object({ id: z.string() })
});
