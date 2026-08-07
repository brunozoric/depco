import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { userResponseSchema } from "#shared/users/index.js";

export const loginRoute = defineRoute({
    method: "POST",
    path: "/api/auth/login",
    description: "Login with email and password",
    params: z.object({}),
    body: z.object({
        email: z.string().email(),
        password: z.string().min(1)
    })
});

export const verifyCodeRoute = defineRoute({
    method: "POST",
    path: "/api/auth/verify-code",
    description: "Verify login code",
    params: z.object({}),
    body: z.object({
        email: z.string().email(),
        code: z.string().length(6)
    }),
    response: z.object({ item: z.object({ token: z.string(), user: userResponseSchema }) })
});

export const magicLinkRoute = defineRoute({
    method: "POST",
    path: "/api/auth/magic-link",
    description: "Request magic link",
    params: z.object({}),
    body: z.object({
        email: z.string().email()
    })
});

export const verifyMagicLinkRoute = defineRoute({
    method: "POST",
    path: "/api/auth/verify-magic-link",
    description: "Verify magic link token",
    params: z.object({}),
    body: z.object({
        token: z.string(),
        email: z.string().email()
    }),
    response: z.object({ item: z.object({ token: z.string(), user: userResponseSchema }) })
});

export const getMeRoute = defineRoute({
    method: "GET",
    path: "/api/auth/me",
    description: "Get current authenticated user",
    params: z.object({}),
    response: z.object({ item: userResponseSchema })
});

export const logoutRoute = defineRoute({
    method: "POST",
    path: "/api/auth/logout",
    description: "Logout current session",
    params: z.object({})
});
