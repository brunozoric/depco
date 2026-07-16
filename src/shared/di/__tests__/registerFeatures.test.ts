import { describe, it, expect, vi } from "vitest";
import { Container } from "@webiny/di";
import { createFeature } from "../createFeature.js";
import { registerFeatures } from "../registerFeatures.js";

describe("registerFeatures", () => {
    it("should register features in dependency order", () => {
        const order: string[] = [];

        const featureA = createFeature({
            name: "A",
            register() {
                order.push("A");
            }
        });

        const featureB = createFeature({
            name: "B",
            dependencies: [featureA],
            register() {
                order.push("B");
            }
        });

        const featureC = createFeature({
            name: "C",
            dependencies: [featureB],
            register() {
                order.push("C");
            }
        });

        const container = new Container();
        registerFeatures(container, [featureC]);

        expect(order).toEqual(["A", "B", "C"]);
    });

    it("should register each feature only once even when depended on by multiple features", () => {
        const registerSpy = vi.fn();

        const sharedFeature = createFeature({
            name: "shared",
            register: registerSpy
        });

        const featureA = createFeature({
            name: "A",
            dependencies: [sharedFeature],
            register() {
                // no-op
            }
        });

        const featureB = createFeature({
            name: "B",
            dependencies: [sharedFeature],
            register() {
                // no-op
            }
        });

        const container = new Container();
        registerFeatures(container, [featureA, featureB]);

        expect(registerSpy).toHaveBeenCalledTimes(1);
    });

    it("should throw on circular dependencies", () => {
        const featureA = createFeature({
            name: "A",
            dependencies: [],
            register() {
                // no-op
            }
        });

        const featureB = createFeature({
            name: "B",
            dependencies: [featureA],
            register() {
                // no-op
            }
        });

        (featureA as { dependencies: unknown[] }).dependencies = [featureB];

        const container = new Container();
        expect(() => registerFeatures(container, [featureB])).toThrow("cycle detected");
    });

    it("should handle empty features array", () => {
        const container = new Container();
        expect(() => registerFeatures(container, [])).not.toThrow();
    });
});
