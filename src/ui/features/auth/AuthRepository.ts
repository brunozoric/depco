import { computed, makeAutoObservable } from "mobx";
import { Cache } from "@webiny/stdlib";
import { AuthRepository as Abstraction } from "./abstractions/AuthRepository.js";

const TOKEN_CACHE_KEY = "auth:token";
const USER_CACHE_KEY = "auth:user";

class AuthRepositoryImpl implements Abstraction.Interface {
    private tokenValue: string | null = null;
    private userValue: Abstraction.User | null = null;

    public constructor(private readonly cache: Cache.Interface) {
        makeAutoObservable(this, { isAuthenticated: computed });

        const tokenResult = this.cache.get<string>(TOKEN_CACHE_KEY);
        if (tokenResult.isOk() && tokenResult.value !== null) {
            this.tokenValue = tokenResult.value;
        }

        const userResult = this.cache.get<Abstraction.User>(USER_CACHE_KEY);
        if (userResult.isOk() && userResult.value !== null) {
            this.userValue = userResult.value;
        }
    }

    public get token(): string | null {
        return this.tokenValue;
    }

    public get currentUser(): Abstraction.User | null {
        return this.userValue;
    }

    public get isAuthenticated(): boolean {
        return this.tokenValue !== null;
    }

    public setAuth(input: Abstraction.SetAuthInput): void {
        this.tokenValue = input.token;
        this.userValue = input.user;
        this.cache.set(TOKEN_CACHE_KEY, input.token);
        this.cache.set(USER_CACHE_KEY, input.user);
    }

    public clearAuth(): void {
        this.tokenValue = null;
        this.userValue = null;
        this.cache.remove(TOKEN_CACHE_KEY);
        this.cache.remove(USER_CACHE_KEY);
    }
}

export const AuthRepository = Abstraction.createImplementation({
    implementation: AuthRepositoryImpl,
    dependencies: [Cache]
});
