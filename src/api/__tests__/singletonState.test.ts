import { describe, it, expect } from "vitest";
import { findSingletonMutableState } from "#testing/helpers/findSingletonMutableState.js";

// Every API singleton is shared by all requests. The ones below mutate state
// after construction on purpose — server-wide caches, queues, connections.
// None of them may ever hold request or user data.
//
// If this test fails because of a new entry: if the state belongs to one
// request or caller, register the class with inContainerScope() so it lives
// in the per-request child container. Only add it here if the state is truly
// server-wide.
const ALLOWED_SINGLETON_STATE: Record<string, string[]> = {
    // Derived encryption key, computed once from ENCRYPTION_KEY.
    EncryptionServiceImpl: ["derivedKey"],
    // Parsed depco.config.ts with a short time-to-live.
    FileConfigServiceImpl: ["cachedAt", "cachedResult"],
    // Job queue bookkeeping: abort controllers, in-flight runs, dedupe set.
    JobWorkerImpl: ["#controllers", "#inFlight", "#refreshTransientJobIds"],
    // Pino output streams; levels change via admin app settings.
    LoggerServiceImpl: ["multistream"],
    // Deduplicates identical in-flight OSV lookups.
    OsvCacheServiceImpl: ["inFlight"],
    // Deduplicates identical in-flight npm registry lookups.
    RegistryCacheServiceImpl: ["inFlight"],
    // Bree scheduler instance and the schedules it runs.
    ScanSchedulerServiceImpl: ["activeJobs", "bree"],
    // Connected WebSocket clients.
    WebSocketBroadcasterImpl: ["clients"]
};

describe("API singleton state", () => {
    const found = findSingletonMutableState({
        rootDirectory: process.cwd(),
        sourceDirectory: "src/api"
    });

    it("only allowlisted singletons mutate state after construction", () => {
        const actual = Object.fromEntries(found.map(entry => [entry.className, entry.fields]));

        expect(actual).toEqual(ALLOWED_SINGLETON_STATE);
    });
});
