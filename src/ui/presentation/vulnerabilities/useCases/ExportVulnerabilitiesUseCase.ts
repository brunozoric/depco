import { ExportVulnerabilitiesUseCase as Abstraction } from "./abstractions/ExportVulnerabilitiesUseCase.js";
import { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

class ExportVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: VulnerabilitiesGateway.Interface) {}

    public execute = (params: Abstraction.Params): void => {
        const url = this.gateway.getExportUrl(params);
        const link = document.createElement("a");
        link.href = url;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

export const ExportVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: ExportVulnerabilitiesUseCaseImpl,
    dependencies: [VulnerabilitiesGateway]
});
