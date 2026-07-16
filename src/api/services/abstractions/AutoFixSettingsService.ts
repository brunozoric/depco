import { createAbstraction } from "#shared/index.js";

export interface IAutoFixSettings {
    id: string;
    projectId: string;
    enabled: boolean;
    upgradeTypes: string[];
    groupingStrategy: string;
    branchPrefix: string;
    createdAt: number;
    updatedAt: number;
}

export interface IUpdateAutoFixSettingsInput {
    enabled?: boolean;
    upgradeTypes?: string[];
    groupingStrategy?: string;
    branchPrefix?: string;
}

export interface IAutoFixSettingsService {
    getSettings(projectId: string): Promise<IAutoFixSettings | null>;
    getSettingsOrDefaults(projectId: string): Promise<IAutoFixSettings>;
    updateSettings(
        projectId: string,
        input: IUpdateAutoFixSettingsInput
    ): Promise<IAutoFixSettings>;
}

export const AutoFixSettingsService = createAbstraction<IAutoFixSettingsService>(
    "Api/AutoFixSettingsService"
);

export namespace AutoFixSettingsService {
    export type Interface = IAutoFixSettingsService;
    export type Settings = IAutoFixSettings;
    export type UpdateInput = IUpdateAutoFixSettingsInput;
}
