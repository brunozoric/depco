import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { RouterFeature } from "../feature.js";
import { RouteRegistry } from "../abstractions/RouteRegistry.js";
import type { IRoute, IRouteMatch } from "../abstractions/Route.js";

function createSimpleRoute(name: string, path: string): IRoute {
    return {
        name,
        path,
        matchPath(currentPath: string): Record<string, string> | null {
            return currentPath === path ? {} : null;
        },
        render(_match: IRouteMatch): React.ReactNode {
            return null;
        }
    };
}

function createRegexRoute(args: { name: string; path: RegExp; paramName: string }): IRoute {
    return {
        name: args.name,
        path: args.path,
        matchPath(currentPath: string): Record<string, string> | null {
            const match = args.path.exec(currentPath);
            if (!match?.[1]) {
                return null;
            }
            return { [args.paramName]: match[1] };
        },
        render(_match: IRouteMatch): React.ReactNode {
            return null;
        }
    };
}

describe("RouteRegistry", () => {
    let container: ReturnType<typeof createContainer>;
    let registry: RouteRegistry.Interface;

    beforeEach(() => {
        container = createContainer();
        RouterFeature.register(container);
        registry = container.resolve(RouteRegistry);
    });

    it("resolves matching string route", () => {
        registry.register(createSimpleRoute("jobs", "/jobs"));
        const result = registry.resolve({ path: "/jobs", query: new URLSearchParams() });
        expect(result).toBeDefined();
        expect(result!.route.name).toBe("jobs");
        expect(result!.match.params).toEqual({});
    });

    it("returns undefined for no match", () => {
        registry.register(createSimpleRoute("jobs", "/jobs"));
        const result = registry.resolve({ path: "/settings", query: new URLSearchParams() });
        expect(result).toBeUndefined();
    });

    it("resolves first matching route (insertion order)", () => {
        registry.register(createSimpleRoute("first", "/test"));
        registry.register(createSimpleRoute("second", "/test"));
        const result = registry.resolve({ path: "/test", query: new URLSearchParams() });
        expect(result!.route.name).toBe("first");
    });

    it("resolves regex route with params", () => {
        registry.register(
            createRegexRoute({
                name: "project-detail",
                path: /^\/projects\/([^/]+)$/,
                paramName: "projectId"
            })
        );
        const result = registry.resolve({ path: "/projects/abc123", query: new URLSearchParams() });
        expect(result).toBeDefined();
        expect(result!.match.params).toEqual({ projectId: "abc123" });
    });

    it("passes validated query to match", () => {
        const route: IRoute = {
            name: "with-query",
            path: "/test",
            matchPath(path: string): Record<string, string> | null {
                return path === "/test" ? {} : null;
            },
            validateQueryString(query: URLSearchParams): Record<string, unknown> {
                return { page: query.get("page") ?? "1" };
            },
            render(_match: IRouteMatch): React.ReactNode {
                return null;
            }
        };
        registry.register(route);
        const result = registry.resolve({ path: "/test", query: new URLSearchParams("page=3") });
        expect(result!.match.query).toEqual({ page: "3" });
    });

    it("returns empty query when validateQueryString not defined", () => {
        registry.register(createSimpleRoute("jobs", "/jobs"));
        const result = registry.resolve({ path: "/jobs", query: new URLSearchParams("x=1") });
        expect(result!.match.query).toEqual({});
    });

    it("more specific regex matches before catch-all", () => {
        registry.register(
            createRegexRoute({
                name: "detail",
                path: /^\/projects\/([^/]+)$/,
                paramName: "projectId"
            })
        );
        const catchAll: IRoute = {
            name: "fallback",
            path: "/",
            matchPath(): Record<string, string> | null {
                return {};
            },
            render(): React.ReactNode {
                return null;
            }
        };
        registry.register(catchAll);
        const result = registry.resolve({ path: "/projects/abc", query: new URLSearchParams() });
        expect(result!.route.name).toBe("detail");
    });
});
