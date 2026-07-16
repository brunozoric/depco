import { describe, it, expect } from "vitest";
import { Container } from "@webiny/di";
import { createContainer } from "../createContainer.js";
import { createAbstraction } from "../createAbstraction.js";

describe("createContainer", () => {
    it("returns a Container instance", () => {
        const container = createContainer();

        expect(container).toBeInstanceOf(Container);
    });
});

describe("create", () => {
    it("creates an Abstraction that can be registered and resolved in a container", () => {
        interface ILogger {
            log(message: string): void;
        }

        const LoggerToken = createAbstraction<ILogger>("Logger");

        const container = createContainer();
        const logger: ILogger = { log: () => {} };
        container.registerInstance(LoggerToken, logger);

        expect(container.resolve(LoggerToken)).toBe(logger);
    });

    it("creates distinct abstractions even with the same name", () => {
        const tokenA = createAbstraction<string>("Duplicate");
        const tokenB = createAbstraction<string>("Duplicate");

        const container = createContainer();
        container.registerInstance(tokenA, "a");
        container.registerInstance(tokenB, "b");

        expect(container.resolve(tokenA)).toBe("a");
        expect(container.resolve(tokenB)).toBe("b");
    });
});
