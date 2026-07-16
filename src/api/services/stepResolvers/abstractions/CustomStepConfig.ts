export interface ICustomStepConfig {
    name: string;
    command: string;
    executionType: "command" | "script" | "package-script";
    required: boolean;
}
