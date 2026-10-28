import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { createAbstraction, createContainer } from "#shared/index.js";
import { registerRequestContainer } from "../requestContainer.js";

interface IRequestState {
    id: number;
}

const RequestState = createAbstraction<IRequestState>("Test/RequestState");
const GlobalState = createAbstraction<IRequestState>("Test/GlobalState");

let nextId = 0;

class RequestStateImpl implements IRequestState {
    public readonly id = ++nextId;
}

class GlobalStateImpl implements IRequestState {
    public readonly id = ++nextId;
}

const RequestStateImplementation = RequestState.createImplementation({
    implementation: RequestStateImpl,
    dependencies: []
});

const GlobalStateImplementation = GlobalState.createImplementation({
    implementation: GlobalStateImpl,
    dependencies: []
});

interface IResolvedIds {
    containerIsRoot: boolean;
    requestFirst: number;
    requestSecond: number;
    global: number;
}

describe("registerRequestContainer", () => {
    let app: FastifyInstance;
    let root: Container;

    beforeEach(async () => {
        root = createContainer();
        root.register(RequestStateImplementation).inContainerScope();
        root.register(GlobalStateImplementation).inSingletonScope();

        app = Fastify();
        registerRequestContainer(app, root);
        app.get("/ids", async request => {
            const ids: IResolvedIds = {
                containerIsRoot: request.container === root,
                requestFirst: request.container.resolve(RequestState).id,
                requestSecond: request.container.resolve(RequestState).id,
                global: request.container.resolve(GlobalState).id
            };
            return ids;
        });
        await app.ready();
    });

    async function fetchIds(): Promise<IResolvedIds> {
        const response = await app.inject({ method: "GET", url: "/ids" });
        return response.json<IResolvedIds>();
    }

    it("gives each request a child container, not the root", async () => {
        const ids = await fetchIds();

        expect(ids.containerIsRoot).toBe(false);
    });

    it("shares a container-scoped instance within one request", async () => {
        const ids = await fetchIds();

        expect(ids.requestFirst).toBe(ids.requestSecond);
    });

    it("isolates container-scoped instances between requests", async () => {
        const first = await fetchIds();
        const second = await fetchIds();

        expect(first.requestFirst).not.toBe(second.requestFirst);
    });

    it("shares root singletons across requests", async () => {
        const first = await fetchIds();
        const second = await fetchIds();

        expect(first.global).toBe(second.global);
    });
});
