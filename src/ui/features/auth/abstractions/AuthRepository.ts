import { createAbstraction } from "#shared/index.js";
import type { UserResponse } from "#shared/users/index.js";

export interface ISetAuthInput {
    token: string;
    user: UserResponse;
}

export interface IAuthRepository {
    get token(): string | null;
    get currentUser(): UserResponse | null;
    get isAuthenticated(): boolean;
    setAuth(input: ISetAuthInput): void;
    clearAuth(): void;
}

export const AuthRepository = createAbstraction<IAuthRepository>("Ui/AuthRepository");

export namespace AuthRepository {
    export type Interface = IAuthRepository;
    export type User = UserResponse;
    export type SetAuthInput = ISetAuthInput;
}
