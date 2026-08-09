import type { RouteDefinition, HTTPMethod, IRequestArgs } from "#shared/routing/index.js";
import { interpolatePath } from "#shared/routing/index.js";
import { HTTPClient as Abstraction } from "./abstractions/HTTPClient.js";
import { AuthRepository } from "../features/Auth/abstractions/AuthRepository.js";

class HTTPClientImpl implements Abstraction.Interface {
    public constructor(private readonly authRepository: AuthRepository.Interface) {}

    public async request<
        TPath extends string,
        TParams,
        TBody,
        TResponse,
        TMethod extends HTTPMethod,
        TQuerystring = never
    >(
        route: RouteDefinition<TPath, TParams, TBody, TResponse, TMethod, TQuerystring>,
        args: IRequestArgs<TMethod, TParams, TBody, TQuerystring>
    ): Promise<TResponse> {
        let url = interpolatePath(route.path, (args.params ?? {}) as Record<string, string>);

        if (args.query) {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(args.query)) {
                if (value == null) {
                    continue;
                }
                if (Array.isArray(value)) {
                    for (const item of value) {
                        searchParams.append(key, item);
                    }
                } else {
                    searchParams.append(key, String(value));
                }
            }
            const queryString = searchParams.toString();
            if (queryString) {
                url = `${url}?${queryString}`;
            }
        }

        const body = (args as { body?: unknown }).body;
        const headers: Record<string, string> = {};
        if (route.method !== "GET" && body !== undefined) {
            headers["Content-Type"] = "application/json";
        }
        const token = this.authRepository.token;
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const init: RequestInit = { method: route.method };
        if (Object.keys(headers).length > 0) {
            init.headers = headers;
        }
        if (route.method !== "GET" && body !== undefined) {
            init.body = JSON.stringify(body);
        }

        const response = await fetch(url, init);
        if (!response.ok) {
            if (response.status === 401) {
                this.authRepository.clearAuth();
            }
            throw new Error(`${route.method} ${url} failed: ${response.status}`);
        }

        if (!route.response) {
            return undefined as TResponse;
        }

        const json = await response.json();
        return route.response.parse(json);
    }
}

export const HTTPClient = Abstraction.createImplementation({
    implementation: HTTPClientImpl,
    dependencies: [AuthRepository]
});
