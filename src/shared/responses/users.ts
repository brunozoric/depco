import { z } from "zod";
import { userResponseSchema } from "#shared/users/index.js";

export const listUsersResponseSchema = z.object({
    items: z.array(userResponseSchema),
    total: z.number()
});

export const getUserResponseSchema = z.object({ item: userResponseSchema });

export const createUserResponseSchema = z.object({ item: userResponseSchema });

export const updateUserResponseSchema = z.object({ item: userResponseSchema });
