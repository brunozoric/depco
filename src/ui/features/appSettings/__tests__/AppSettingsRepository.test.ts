import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { AppSettingsRepository } from "../abstractions/AppSettingsRepository.js";
import { AppSettingsRepository as AppSettingsRepositoryRegistration } from "../AppSettingsRepository.js";

function createRepo(): AppSettingsRepository.Interface {
    const container = createContainer();
    container.register(AppSettingsRepositoryRegistration);
    return container.resolve(AppSettingsRepository);
}

const setting: AppSettingsRepository.AppSetting = {
    key: "theme",
    value: "dark"
};

describe("AppSettingsRepository", () => {
    it("returns empty array when no settings set", () => {
        const repo = createRepo();

        expect(repo.getSettings()).toEqual([]);
    });

    it("stores and retrieves settings via setSettings/getSettings", () => {
        const repo = createRepo();

        repo.setSettings([setting]);

        expect(repo.getSettings()).toEqual([setting]);
    });

    it("overwrites previously stored settings", () => {
        const repo = createRepo();
        repo.setSettings([setting]);
        const otherSetting: AppSettingsRepository.AppSetting = { key: "lang", value: "en" };

        repo.setSettings([otherSetting]);

        expect(repo.getSettings()).toEqual([otherSetting]);
    });

    it("upsertSetting adds new setting when key not found", () => {
        const repo = createRepo();
        repo.setSettings([setting]);
        const newSetting: AppSettingsRepository.AppSetting = { key: "lang", value: "en" };

        repo.upsertSetting(newSetting);

        expect(repo.getSettings()).toEqual([setting, newSetting]);
    });

    it("upsertSetting updates existing setting when key matches", () => {
        const repo = createRepo();
        repo.setSettings([setting]);
        const updated: AppSettingsRepository.AppSetting = { key: "theme", value: "light" };

        repo.upsertSetting(updated);

        expect(repo.getSettings()).toEqual([updated]);
    });

    it("getConfigSource defaults to db", () => {
        const repo = createRepo();

        expect(repo.getConfigSource()).toBe("db");
    });

    it("setConfigSource/getConfigSource stores and retrieves config source", () => {
        const repo = createRepo();

        repo.setConfigSource("file");

        expect(repo.getConfigSource()).toBe("file");
    });

    it("getFileManaged defaults to empty array", () => {
        const repo = createRepo();

        expect(repo.getFileManaged()).toEqual([]);
    });

    it("setFileManaged/getFileManaged stores and retrieves file managed keys", () => {
        const repo = createRepo();
        const keys = ["theme", "lang"];

        repo.setFileManaged(keys);

        expect(repo.getFileManaged()).toEqual(keys);
    });

    it("getConfigError defaults to null", () => {
        const repo = createRepo();

        expect(repo.getConfigError()).toBeNull();
    });

    it("setConfigError/getConfigError stores and retrieves config error", () => {
        const repo = createRepo();
        const error: AppSettingsRepository.ConfigError = { type: "json", message: "invalid json" };

        repo.setConfigError(error);

        expect(repo.getConfigError()).toEqual(error);
    });
});
