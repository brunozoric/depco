import { createAbstraction } from "#shared/index.js";
import type { UserResponse } from "#shared/users/index.js";

export interface ILoginInput {
    email: string;
    password: string;
}

export interface IVerifyCodeInput {
    email: string;
    code: string;
}

export interface IMagicLinkInput {
    email: string;
}

export interface IVerifyMagicLinkInput {
    token: string;
    email: string;
}

export interface IAuthResult {
    token: string;
    user: UserResponse;
}

export interface IAuthGateway {
    login(input: ILoginInput): Promise<void>;
    verifyCode(input: IVerifyCodeInput): Promise<IAuthResult>;
    requestMagicLink(input: IMagicLinkInput): Promise<void>;
    verifyMagicLink(input: IVerifyMagicLinkInput): Promise<IAuthResult>;
    logout(): Promise<void>;
    getMe(): Promise<UserResponse>;
}

export const AuthGateway = createAbstraction<IAuthGateway>("Ui/AuthGateway");

export namespace AuthGateway {
    export type Interface = IAuthGateway;
    export type LoginInput = ILoginInput;
    export type VerifyCodeInput = IVerifyCodeInput;
    export type MagicLinkInput = IMagicLinkInput;
    export type VerifyMagicLinkInput = IVerifyMagicLinkInput;
    export type AuthResult = IAuthResult;
    export type User = UserResponse;
}
