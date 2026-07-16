import { describe, it, expect, expectTypeOf } from "vitest";
import { Container } from "@webiny/di";
import { createFeature } from "../createFeature.js";
import type { FeatureDefinition } from "../createFeature.js";

const fakeContainer = {} as Container;

// ---------------------------------------------------------------------------
// Runtime behaviour tests
// ---------------------------------------------------------------------------

describe("createFeature", () => {
    it("creates a feature with name and register (no resolve)", () => {
        const feature = createFeature({
            name: "test-feature",
            register(_container: Container) {
                // no-op
            }
        });

        expect(feature.name).toBe("test-feature");
        expect(typeof feature.register).toBe("function");
        expect(feature.resolve).toBeUndefined();
    });

    it("creates a feature with resolve that returns typed exports", () => {
        interface TestExports {
            getValue(): number;
        }

        const feature = createFeature<void, TestExports>({
            name: "feature-with-resolve",
            register(_container: Container) {
                // no-op
            },
            resolve(_container: Container): TestExports {
                return { getValue: () => 42 };
            }
        });

        expect(feature.name).toBe("feature-with-resolve");
        expect(typeof feature.register).toBe("function");
        expect(typeof feature.resolve).toBe("function");
        expect(feature.resolve(fakeContainer).getValue()).toBe(42);
    });

    it("resolve is optional — features without it still work", () => {
        const feature = createFeature({
            name: "no-resolve-feature",
            register(_container: Container) {
                // no-op
            }
        });

        expect(feature.resolve).toBeUndefined();
    });

    it("sets wby:isFeature metadata on created feature", () => {
        const feature = createFeature({
            name: "metadata-feature",
            register(_container: Container) {
                // no-op
            }
        });

        expect(Reflect.getMetadata("wby:isFeature", feature)).toBe(true);
    });
});

describe("createFeature with dependencies", () => {
    it("should accept dependencies array", () => {
        const dependencyFeature = createFeature({
            name: "dep",
            register() {
                // no-op
            }
        });

        const feature = createFeature({
            name: "main",
            dependencies: [dependencyFeature],
            register() {
                // no-op
            }
        });

        expect(feature.dependencies).toEqual([dependencyFeature]);
    });

    it("should default dependencies to empty array when not provided", () => {
        const feature = createFeature({
            name: "no-deps",
            register() {
                // no-op
            }
        });

        expect(feature.dependencies).toEqual([]);
    });
});

describe("createFeature with routes", () => {
    it("should accept routes function", () => {
        const routesFunction = () => {
            // no-op
        };
        const feature = createFeature({
            name: "with-routes",
            routes: routesFunction,
            register() {
                // no-op
            }
        });

        expect(feature.routes).toBe(routesFunction);
    });

    it("should leave routes undefined when not provided", () => {
        const feature = createFeature({
            name: "no-routes",
            register() {
                // no-op
            }
        });

        expect(feature.routes).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Compile-time type assertions
// ---------------------------------------------------------------------------

describe("FeatureDefinition compile-time assertions", () => {
    it("FeatureDefinition with no generics has no resolve", () => {
        type NoResolve = FeatureDefinition;
        expectTypeOf<NoResolve>().toHaveProperty("resolve").toEqualTypeOf<undefined>();
    });

    it("FeatureDefinition with TRegister only has no resolve", () => {
        interface MyContext {
            tenantId: string;
        }
        type WithRegister = FeatureDefinition<MyContext>;
        expectTypeOf<WithRegister>().toHaveProperty("resolve").toEqualTypeOf<undefined>();
    });

    it("FeatureDefinition with TExports has resolve returning TExports", () => {
        interface MyExports {
            doSomething(): void;
        }
        type WithResolve = FeatureDefinition<void, MyExports>;
        type ResolveFn = (container: Container) => MyExports;
        expectTypeOf<WithResolve>().toHaveProperty("resolve").toEqualTypeOf<ResolveFn>();
    });

    it("FeatureDefinition with both TRegister and TExports has resolve and context register", () => {
        interface MyContext {
            tenantId: string;
        }
        interface MyExports {
            doSomething(): void;
        }
        type Full = FeatureDefinition<MyContext, MyExports>;
        type ResolveFn = (container: Container) => MyExports;
        expectTypeOf<Full>().toHaveProperty("resolve").toEqualTypeOf<ResolveFn>();
    });
});
