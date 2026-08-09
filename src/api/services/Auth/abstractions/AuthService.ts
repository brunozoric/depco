import { createAbstraction } from "#shared/index.js";
import type { UserResponse } from "#shared/users/index.js";

export interface ISessionUser {
    id: string;
    email: string;
    displayName: string;
    permission: string;
}

export interface IVerifyResult {
    token: string;
    user: UserResponse;
}

export interface ILoginParams {
    email: string;
    password: string;
}

export interface IVerifyCodeParams {
    email: string;
    code: string;
}

export interface IRequestMagicLinkParams {
    email: string;
    baseUrl: string;
}

export interface IVerifyMagicLinkParams {
    token: string;
    email: string;
}

export interface IAuthService {
    login(params: ILoginParams): Promise<void>;
    verifyCode(params: IVerifyCodeParams): Promise<IVerifyResult>;
    requestMagicLink(params: IRequestMagicLinkParams): Promise<void>;
    verifyMagicLink(params: IVerifyMagicLinkParams): Promise<IVerifyResult>;
    getSessionUser(tokenHash: string): Promise<ISessionUser | null>;
    logout(tokenHash: string): Promise<void>;
    forceLogout(userId: string): Promise<void>;
    cleanupExpired(): Promise<void>;
}

export const AuthService = createAbstraction<IAuthService>("Api/AuthService");

export namespace AuthService {
    export type Interface = IAuthService;
    export type SessionUser = ISessionUser;
    export type VerifyResult = IVerifyResult;
    export type LoginParams = ILoginParams;
    export type VerifyCodeParams = IVerifyCodeParams;
    export type RequestMagicLinkParams = IRequestMagicLinkParams;
    export type VerifyMagicLinkParams = IVerifyMagicLinkParams;
}
