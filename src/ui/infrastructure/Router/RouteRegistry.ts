import { RouteRegistry as Abstraction } from "./abstractions/RouteRegistry.js";
import { Route } from "./abstractions/Route.js";
import type { IRoute } from "./abstractions/Route.js";

class RouteRegistryImpl implements Abstraction.Interface {
    public constructor(private readonly routes: IRoute[]) {}

    public resolve(args: Abstraction.ResolveArgs): Abstraction.ResolveResult | undefined {
        for (const route of this.routes) {
            const params = route.matchPath(args.path);
            if (params !== null) {
                const query = route.validateQueryString
                    ? route.validateQueryString(args.query)
                    : {};
                return { route, match: { params, query } };
            }
        }
        return undefined;
    }
}

export const RouteRegistry = Abstraction.createImplementation({
    implementation: RouteRegistryImpl,
    dependencies: [[Route, { multiple: true }]]
});
