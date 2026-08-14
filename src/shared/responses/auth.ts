import { z } from "zod";
import { userResponseSchema } from "#shared/users/index.js";

export const authSessionSchema = z.object({
    token: z.string(),
    user: userResponseSchema
});

export const verifyCodeResponseSchema = z.object({
    item: authSessionSchema
});

export const verifyMagicLinkResponseSchema = z.object({
    item: authSessionSchema
});

export const getMeResponseSchema = z.object({
    item: userResponseSchema
});

export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;
export type VerifyMagicLinkResponse = z.infer<typeof verifyMagicLinkResponseSchema>;
export type GetMeResponse = z.infer<typeof getMeResponseSchema>;
