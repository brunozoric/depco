export interface IInstallFlagDefinition {
    flag: string;
    label: string;
    description: string;
    exclusive?: string;
    defaultEnabled: boolean;
}
