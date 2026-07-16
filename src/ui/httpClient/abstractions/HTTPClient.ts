import { createAbstraction } from "#shared/index.js";
import type { RouteDefinition, HTTPMethod, IRequestArgs } from "#shared/routing/index.js";

export interface IHTTPClient {
    request<
        TPath extends string,
        TParams,
        TBody,
        TResponse,
        TMethod extends HTTPMethod,
        TQuerystring = never
    >(
        route: RouteDefinition<TPath, TParams, TBody, TResponse, TMethod, TQuerystring>,
        args: IRequestArgs<TMethod, TParams, TBody, TQuerystring>
    ): Promise<TResponse>;
}

export const HTTPClient = createAbstraction<IHTTPClient>("Ui/HTTPClient");

export namespace HTTPClient {
    export type Interface = IHTTPClient;
}
