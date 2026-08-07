import { z } from "zod";

export const USER_PERMISSIONS = ["full", "read-only"] as const;

export const userPermissionSchema = z.enum(USER_PERMISSIONS);

export type UserPermission = z.infer<typeof userPermissionSchema>;

export const userResponseSchema = z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    permission: userPermissionSchema,
    isActive: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number()
});

export type UserResponse = z.infer<typeof userResponseSchema>;
