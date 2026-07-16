import type { Container } from "@webiny/di";

export interface FeatureRoutes {
    (app: unknown): void | Promise<void>;
}

export type AnyFeature = {
    name: string;
    dependencies: AnyFeature[];
    register(container: Container, context?: unknown): void;
    routes?: FeatureRoutes | undefined;
    resolve?: ((container: Container) => unknown) | undefined;
};

export type FeatureDefinition<TRegister = void, TExports = undefined> = [TRegister] extends [void]
    ? [TExports] extends [undefined]
        ? {
              name: string;
              dependencies?: AnyFeature[];
              register(container: Container): void;
              routes?: FeatureRoutes;
              resolve?: undefined;
          }
        : {
              name: string;
              dependencies?: AnyFeature[];
              register(container: Container): void;
              routes?: FeatureRoutes;
              resolve(container: Container): TExports;
          }
    : [TExports] extends [undefined]
      ? {
            name: string;
            dependencies?: AnyFeature[];
            register(container: Container, context: TRegister): void;
            routes?: FeatureRoutes;
            resolve?: undefined;
        }
      : {
            name: string;
            dependencies?: AnyFeature[];
            register(container: Container, context: TRegister): void;
            routes?: FeatureRoutes;
            resolve(container: Container): TExports;
        };

export function createFeature<TRegister = void, TExports = undefined>(
    def: FeatureDefinition<TRegister, TExports>
): FeatureDefinition<TRegister, TExports> & { dependencies: AnyFeature[] } {
    const feature = {
        name: def.name,
        dependencies: def.dependencies ?? [],
        register: def.register,
        routes: def.routes,
        resolve: def.resolve
    };

    Reflect.defineMetadata("wby:isFeature", true, feature);

    return feature as FeatureDefinition<TRegister, TExports> & { dependencies: AnyFeature[] };
}
