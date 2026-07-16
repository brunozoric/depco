import type { RouteDefinition, HTTPMethod, IRequestArgs } from "#shared/routing/index.js";
import { interpolatePath } from "#shared/routing/index.js";
import { HTTPClient as Abstraction } from "./abstractions/HTTPClient.js";

class HTTPClientImpl implements Abstraction.Interface {
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
                if (Array.isArray(value)) {
                    for (const item of value) {
                        searchParams.append(key, item);
                    }
                } else {
                    searchParams.append(key, value);
                }
            }
            const queryString = searchParams.toString();
            if (queryString) {
                url = `${url}?${queryString}`;
            }
        }

        const body = (args as { body?: unknown }).body;
        const init: RequestInit = { method: route.method };
        if (route.method !== "GET" && body !== undefined) {
            init.headers = { "Content-Type": "application/json" };
            init.body = JSON.stringify(body);
        }

        const response = await fetch(url, init);
        if (!response.ok) {
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
    dependencies: []
});
