import { InitCommand as Abstraction } from "./abstractions/InitCommand.js";
import { EnsureDataDirectoryStep } from "./steps/EnsureDataDirectory/index.js";
import { RunMigrationsStep } from "./steps/RunMigrations/index.js";
import { GenerateEncryptionKeyStep } from "./steps/GenerateEncryptionKey/index.js";
import { SelectPortStep } from "./steps/SelectPort/index.js";
import { CreateAdminUserStep } from "./steps/CreateAdminUser/index.js";
import { WriteEnvFileStep } from "./steps/WriteEnvFile/index.js";
import { PrintNextStepsStep } from "./steps/PrintNextSteps/index.js";
import type { Step } from "../../runner/abstractions/Step.js";

class InitCommandImpl implements Abstraction.Interface {
    public name = "init";
    public description = "Initialize depco — create database, admin user, and environment config";

    public constructor(
        private ensureDataDirectory: Step.Interface,
        private runMigrations: Step.Interface,
        private generateEncryptionKey: Step.Interface,
        private selectPort: Step.Interface,
        private createAdminUser: Step.Interface,
        private writeEnvFile: Step.Interface,
        private printNextSteps: Step.Interface
    ) {}

    public steps(): Step.Interface[] {
        return [
            this.ensureDataDirectory,
            this.runMigrations,
            this.generateEncryptionKey,
            this.selectPort,
            this.createAdminUser,
            this.writeEnvFile,
            this.printNextSteps
        ];
    }

    public context(): Step.Context {
        return {
            dataDirectory: "./data",
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
    }
}

export const InitCommand = Abstraction.createImplementation({
    implementation: InitCommandImpl,
    dependencies: [
        EnsureDataDirectoryStep,
        RunMigrationsStep,
        GenerateEncryptionKeyStep,
        SelectPortStep,
        CreateAdminUserStep,
        WriteEnvFileStep,
        PrintNextStepsStep
    ]
});
