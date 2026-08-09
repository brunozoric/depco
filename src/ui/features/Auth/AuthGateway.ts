import { AuthGateway as Abstraction } from "./abstractions/AuthGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    loginRoute,
    verifyCodeRoute,
    magicLinkRoute,
    verifyMagicLinkRoute,
    getMeRoute,
    logoutRoute
} from "#shared/routes/index.js";

class AuthGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async login(input: Abstraction.LoginInput): Promise<void> {
        await this.httpClient.request(loginRoute, { params: {}, body: input });
    }

    public async verifyCode(input: Abstraction.VerifyCodeInput): Promise<Abstraction.AuthResult> {
        const response = await this.httpClient.request(verifyCodeRoute, {
            params: {},
            body: input
        });
        return response.item;
    }

    public async requestMagicLink(input: Abstraction.MagicLinkInput): Promise<void> {
        await this.httpClient.request(magicLinkRoute, { params: {}, body: input });
    }

    public async verifyMagicLink(
        input: Abstraction.VerifyMagicLinkInput
    ): Promise<Abstraction.AuthResult> {
        const response = await this.httpClient.request(verifyMagicLinkRoute, {
            params: {},
            body: input
        });
        return response.item;
    }

    public async logout(): Promise<void> {
        await this.httpClient.request(logoutRoute, { params: {} });
    }

    public async getMe(): Promise<Abstraction.User> {
        const response = await this.httpClient.request(getMeRoute, { params: {} });
        return response.item;
    }
}

export const AuthGateway = Abstraction.createImplementation({
    implementation: AuthGatewayImpl,
    dependencies: [HTTPClient]
});
