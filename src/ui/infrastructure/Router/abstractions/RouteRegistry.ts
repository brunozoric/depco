import { createAbstraction } from "#shared/index.js";
import type { Route } from "./Route.js";

export interface IRouteResolveArgs {
    path: string;
    query: URLSearchParams;
}

export interface IRouteResolveResult {
    route: Route.Interface;
    match: Route.Match;
}

export interface IRouteRegistry {
    resolve(args: IRouteResolveArgs): IRouteResolveResult | undefined;
}

export const RouteRegistry = createAbstraction<IRouteRegistry>("Ui/RouteRegistry");

export namespace RouteRegistry {
    export type Interface = IRouteRegistry;
    export type ResolveArgs = IRouteResolveArgs;
    export type ResolveResult = IRouteResolveResult;
}
