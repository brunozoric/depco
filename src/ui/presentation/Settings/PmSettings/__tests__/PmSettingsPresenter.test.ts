import { describe, it, expect, beforeEach } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import {
    listSecuritySettingsRoute,
    createSecuritySettingRoute,
    updateSecuritySettingRoute,
    toggleSecuritySettingRoute,
    resetSecuritySettingsRoute,
    listPmSettingsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../infrastructure/HttpClient/feature.js";
import { PmSettingsFeature } from "../../../../features/Settings/feature.js";
import { SecuritySettingsUseCasesFeature } from "../../useCases/feature.js";
import { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { PmSettingsPresenter as PmSettingsPresenterRegistration } from "../PmSettingsPresenter.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("PmSettingsPresenter", () => {
    let calls: RecordedCall[];
    let listResult: unknown[];
    let createResult: unknown;
    let updateResult: unknown;
    let toggleResult: unknown;
    let resetResult: unknown[];
    let listConfigSource: "db" | "file" | "error";
    let listFileManagedPms: string[];
    let listConfigError: { type: string; message: string } | undefined;
    let pmConfigResult: unknown[];

    function createPresenter(): PmSettingsPresenter.Interface {
        const container: Container = createContainer();

        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                switch (route) {
                    case listSecuritySettingsRoute:
                        return {
                            items: listResult,
                            total: listResult.length,
                            configSource: listConfigSource,
                            fileManagedPms: listFileManagedPms,
                            configError: listConfigError
                        } as T;
                    case createSecuritySettingRoute:
                        return { item: createResult } as T;
                    case updateSecuritySettingRoute:
                        return { item: updateResult } as T;
                    case toggleSecuritySettingRoute:
                        return { item: toggleResult } as T;
                    case resetSecuritySettingsRoute:
                        return { items: resetResult, total: resetResult.length } as T;
                    case listPmSettingsRoute:
                        return {
                            items: pmConfigResult,
                            configSource: listConfigSource,
                            fileManagedPms: listFileManagedPms,
                            configError: listConfigError
                        } as T;
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        PmSettingsFeature.register(container);
        SecuritySettingsUseCasesFeature.register(container);
        container.register(PmSettingsPresenterRegistration);

        return container.resolve(PmSettingsPresenter);
    }

    beforeEach(() => {
        calls = [];
        listResult = [];
        createResult = {};
        updateResult = {};
        toggleResult = {};
        resetResult = [];
        listConfigSource = "db";
        listFileManagedPms = [];
        listConfigError = undefined;
        pmConfigResult = [];
    });

    it("starts with default idle view model", () => {
        const presenter = createPresenter();

        expect(presenter.vm.loading).toBe(false);
        expect(presenter.vm.error).toBeNull();
        expect(presenter.vm.selectedPackageManager).toBe("yarn");
        expect(presenter.vm.settings).toEqual([]);
        expect(presenter.vm.editingId).toBeNull();
        expect(presenter.vm.addingField).toBeNull();
    });

    it("shows available yarn fields when no settings exist", () => {
        const presenter = createPresenter();

        expect(presenter.vm.availableFields).toHaveLength(4);
        expect(presenter.vm.availableFields.map(f => f.fieldName)).toEqual([
            "npmPreapprovedPackages",
            "npmMinimalAgeGate",
            "enableScripts",
            "approvedGitRepositories"
        ]);
    });

    it("loads settings and updates vm", async () => {
        listResult = [
            {
                id: "s1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            }
        ];

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.settings).toHaveLength(1);
        expect(presenter.vm.settings[0]?.fieldName).toBe("enableScripts");
        expect(presenter.vm.settings[0]?.description).toBe(
            "Whether lifecycle scripts are allowed to run during install"
        );
        expect(presenter.vm.availableFields).toHaveLength(3);
    });

    it("filters settings by selected PM", async () => {
        listResult = [
            {
                id: "s1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            }
        ];

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.settings).toHaveLength(1);

        presenter.selectPackageManager("npm");

        expect(presenter.vm.settings).toHaveLength(0);
        expect(presenter.vm.availableFields).toHaveLength(4);
    });

    it("selectPackageManager clears editingId, addingField, and error", () => {
        const presenter = createPresenter();
        presenter.startAdd("enableScripts");
        expect(presenter.vm.addingField).toBe("enableScripts");

        presenter.selectPackageManager("npm");

        expect(presenter.vm.addingField).toBeNull();
        expect(presenter.vm.editingId).toBeNull();
        expect(presenter.vm.error).toBeNull();
    });

    it("startAdd sets addingField and clears editingId", () => {
        const presenter = createPresenter();
        presenter.startEdit("s1");
        presenter.startAdd("enableScripts");

        expect(presenter.vm.addingField).toBe("enableScripts");
        expect(presenter.vm.editingId).toBeNull();
    });

    it("startEdit sets editingId and clears addingField", () => {
        const presenter = createPresenter();
        presenter.startAdd("enableScripts");
        presenter.startEdit("s1");

        expect(presenter.vm.editingId).toBe("s1");
        expect(presenter.vm.addingField).toBeNull();
    });

    it("confirmAdd creates a setting and clears addingField", async () => {
        createResult = {
            id: "new-1",
            packageManager: "yarn",
            configFile: ".yarnrc.yml",
            fieldName: "enableScripts",
            expectedValue: "false"
        };

        const presenter = createPresenter();
        presenter.startAdd("enableScripts");
        await presenter.confirmAdd("false");

        expect(presenter.vm.addingField).toBeNull();
        expect(presenter.vm.settings).toHaveLength(1);
        expect(presenter.vm.settings[0]?.id).toBe("new-1");
        expect(calls.some(c => c.route === createSecuritySettingRoute)).toBe(true);
    });

    it("confirmEdit updates a setting and clears editingId", async () => {
        listResult = [
            {
                id: "s1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            }
        ];
        updateResult = {
            id: "s1",
            packageManager: "yarn",
            configFile: ".yarnrc.yml",
            fieldName: "enableScripts",
            expectedValue: "true"
        };

        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.startEdit("s1");
        await presenter.confirmEdit("true");

        expect(presenter.vm.editingId).toBeNull();
        expect(presenter.vm.settings[0]?.expectedValue).toBe("true");
        expect(calls.some(c => c.route === updateSecuritySettingRoute)).toBe(true);
    });

    it("toggle flips a setting's enabled state", async () => {
        listResult = [
            {
                id: "s1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false",
                enabled: true
            }
        ];
        toggleResult = {
            id: "s1",
            packageManager: "yarn",
            configFile: ".yarnrc.yml",
            fieldName: "enableScripts",
            expectedValue: "false",
            enabled: false
        };

        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        await presenter.toggle("s1");

        expect(presenter.vm.settings).toHaveLength(1);
        expect(presenter.vm.settings[0]?.enabled).toBe(false);
        expect(calls.some(c => c.route === toggleSecuritySettingRoute)).toBe(true);
    });

    it("sets error on failed confirmAdd", async () => {
        const container: Container = createContainer();
        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown): Promise<T> => {
                if (route === createSecuritySettingRoute) {
                    throw new Error("Server error");
                }
                if (route === listSecuritySettingsRoute) {
                    return { items: [], total: 0 } as T;
                }
                return {} as T;
            }
        });
        PmSettingsFeature.register(container);
        SecuritySettingsUseCasesFeature.register(container);
        container.register(PmSettingsPresenterRegistration);
        const failPresenter = container.resolve(PmSettingsPresenter);

        failPresenter.startAdd("enableScripts");
        await failPresenter.confirmAdd("false");

        expect(failPresenter.vm.error).toBe("Server error");
        expect(failPresenter.vm.addingField).toBe("enableScripts");
    });

    it("cancelAdd clears addingField but not error", () => {
        const presenter = createPresenter();
        presenter.startAdd("enableScripts");
        presenter.cancelAdd();

        expect(presenter.vm.addingField).toBeNull();
    });

    it("cancelEdit clears editingId but not error", () => {
        const presenter = createPresenter();
        presenter.startEdit("s1");
        presenter.cancelEdit();

        expect(presenter.vm.editingId).toBeNull();
    });

    it("canReset is true for yarn and npm (both have registry fields)", () => {
        const presenter = createPresenter();

        expect(presenter.vm.canReset).toBe(true);

        presenter.selectPackageManager("npm");

        expect(presenter.vm.canReset).toBe(true);
    });

    it("resetToDefaults calls reset endpoint and replaces settings for selected PM", async () => {
        listResult = [
            {
                id: "s1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "true"
            }
        ];
        resetResult = [
            {
                id: "r1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "npmPreapprovedPackages",
                expectedValue: "exists"
            },
            {
                id: "r2",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "npmMinimalAgeGate",
                expectedValue: "3d"
            },
            {
                id: "r3",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            },
            {
                id: "r4",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "approvedGitRepositories",
                expectedValue: "exists"
            }
        ];

        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        await presenter.resetToDefaults();

        expect(calls).toEqual([
            {
                route: resetSecuritySettingsRoute,
                args: { params: {}, body: { packageManager: "yarn" } }
            }
        ]);
        expect(presenter.vm.settings).toHaveLength(4);
        expect(
            presenter.vm.settings.find(s => s.fieldName === "enableScripts")?.expectedValue
        ).toBe("false");
        expect(presenter.vm.availableFields).toHaveLength(0);
        expect(presenter.vm.loading).toBe(false);
    });

    it("resetToDefaults clears editing and adding state", async () => {
        const presenter = createPresenter();
        presenter.startAdd("enableScripts");

        resetResult = [];
        await presenter.resetToDefaults();

        expect(presenter.vm.addingField).toBeNull();
        expect(presenter.vm.editingId).toBeNull();
    });

    it("marks settings as orphaned when fieldName is not in the registry", async () => {
        listResult = [
            {
                id: "s1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            },
            {
                id: "s2",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "removedField",
                expectedValue: "something"
            }
        ];

        const presenter = createPresenter();
        await presenter.load();

        const scripts = presenter.vm.settings.find(s => s.fieldName === "enableScripts");
        const orphaned = presenter.vm.settings.find(s => s.fieldName === "removedField");

        expect(scripts?.isOrphaned).toBe(false);
        expect(orphaned?.isOrphaned).toBe(true);
        expect(orphaned?.description).toBe("removedField");
    });

    it("exposes helperText and inputType from registry", async () => {
        listResult = [
            {
                id: "s1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            }
        ];

        const presenter = createPresenter();
        await presenter.load();

        const setting = presenter.vm.settings[0];
        expect(setting?.inputType).toBe("boolean");
        expect(setting?.helperText).toBe(
            "Set to false to prevent lifecycle scripts from running. More secure."
        );
    });

    it("exposes inputType on available fields", () => {
        const presenter = createPresenter();

        const existsField = presenter.vm.availableFields.find(
            f => f.fieldName === "npmPreapprovedPackages"
        );
        expect(existsField?.inputType).toBe("exists");

        const durationField = presenter.vm.availableFields.find(
            f => f.fieldName === "npmMinimalAgeGate"
        );
        expect(durationField?.inputType).toBe("duration");
    });

    it("vm exposes configSource and fileManagedPms from gateway", async () => {
        listConfigSource = "file";
        listFileManagedPms = ["pnpm"];
        listResult = [
            {
                id: "1",
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "ignoreScripts",
                expectedValue: "true",
                enabled: true
            }
        ];

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.configSource).toBe("file");
        expect(presenter.vm.fileManagedPms).toEqual(["pnpm"]);
    });

    it("vm exposes configError when present", async () => {
        listConfigSource = "error";
        listConfigError = { type: "json", message: "Unexpected token" };

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.configError).toEqual({ type: "json", message: "Unexpected token" });
    });

    it("vm.settings marks isFileManaged when PM is in fileManagedPms", async () => {
        listConfigSource = "file";
        listFileManagedPms = ["pnpm"];
        listResult = [
            {
                id: "1",
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "ignoreScripts",
                expectedValue: "true",
                enabled: true
            }
        ];

        const presenter = createPresenter();
        presenter.selectPackageManager("pnpm");
        await presenter.load();

        expect(presenter.vm.settings[0]!.isFileManaged).toBe(true);
    });

    it("vm.activeTab defaults to security", () => {
        const presenter = createPresenter();

        expect(presenter.vm.activeTab).toBe("security");
    });

    it("setActiveTab changes vm.activeTab", () => {
        const presenter = createPresenter();

        presenter.setActiveTab("install");

        expect(presenter.vm.activeTab).toBe("install");
    });

    it("vm.installFlags shows flags for selected PM", async () => {
        pmConfigResult = [
            {
                packageManager: "pnpm",
                installFlags: [
                    {
                        flag: "--frozen-lockfile",
                        label: "Frozen Lockfile",
                        description: "Fail if the lockfile would be updated",
                        enabled: true,
                        defaultEnabled: true,
                        isFileManaged: false
                    }
                ],
                general: { registryUrl: null, upgradeStrategy: null }
            }
        ];

        const presenter = createPresenter();
        await presenter.load();
        presenter.selectPackageManager("pnpm");

        expect(presenter.vm.installFlags).toHaveLength(1);
        expect(presenter.vm.installFlags[0]?.flag).toBe("--frozen-lockfile");
        expect(presenter.vm.installFlags[0]?.enabled).toBe(true);
    });

    it("vm.generalSettings shows registry URL and strategy for selected PM", async () => {
        pmConfigResult = [
            {
                packageManager: "pnpm",
                installFlags: [],
                general: {
                    registryUrl: "https://custom.registry.example.com",
                    upgradeStrategy: "minor"
                }
            }
        ];

        const presenter = createPresenter();
        await presenter.load();
        presenter.selectPackageManager("pnpm");

        expect(presenter.vm.generalSettings.registryUrl).toBe(
            "https://custom.registry.example.com"
        );
        expect(presenter.vm.generalSettings.upgradeStrategy).toBe("minor");
    });
});
