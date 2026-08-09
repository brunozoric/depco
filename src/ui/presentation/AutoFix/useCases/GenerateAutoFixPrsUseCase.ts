import { GenerateAutoFixPrsUseCase as Abstraction } from "./abstractions/GenerateAutoFixPrsUseCase.js";
import { AutoFixGateway } from "../../../features/AutoFix/abstractions/AutoFixGateway.js";

class GenerateAutoFixPrsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: AutoFixGateway.Interface) {}

    public execute = async (projectId: string): Promise<AutoFixGateway.GenerateResult> => {
        return this.gateway.generate(projectId);
    };
}

export const GenerateAutoFixPrsUseCase = Abstraction.createImplementation({
    implementation: GenerateAutoFixPrsUseCaseImpl,
    dependencies: [AutoFixGateway]
});
