import type React from "react";
import { createAbstraction } from "#shared/index.js";

export interface IRouteMatch {
    params: Record<string, string>;
    query: Record<string, unknown>;
}

export interface IRoute {
    name: string;
    path: string | RegExp;
    matchPath(path: string): Record<string, string> | null;
    validateQueryString?(query: URLSearchParams): Record<string, unknown>;
    render(match: IRouteMatch): React.ReactNode;
}

export const Route = createAbstraction<IRoute>("Ui/Route");

export namespace Route {
    export type Interface = IRoute;
    export type Match = IRouteMatch;
}
