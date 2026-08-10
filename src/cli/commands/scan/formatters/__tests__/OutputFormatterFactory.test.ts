import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { OutputFormatterFactory } from "../abstractions/OutputFormatterFactory.js";
import { OutputFormatterFeature } from "../feature.js";
import { TableFormatter } from "../TableFormatter.js";
import { JsonFormatter } from "../JsonFormatter.js";

describe("OutputFormatterFactory", () => {
    let factory: OutputFormatterFactory.Interface;

    beforeEach(() => {
        const container = createContainer();
        registerFeatures(container, [OutputFormatterFeature]);
        factory = container.resolve(OutputFormatterFactory);
    });

    it("creates TableFormatter for 'table'", () => {
        const formatter = factory.create({ format: "table" });
        expect(formatter).toBeInstanceOf(TableFormatter);
    });

    it("creates JsonFormatter for 'json'", () => {
        const formatter = factory.create({ format: "json" });
        expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it("defaults to TableFormatter for unknown format", () => {
        const formatter = factory.create({ format: "unknown" });
        expect(formatter).toBeInstanceOf(TableFormatter);
    });
});
