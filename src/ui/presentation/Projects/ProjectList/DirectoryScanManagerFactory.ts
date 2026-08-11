import { DirectoryScanManagerFactory as Abstraction } from "./abstractions/DirectoryScanManagerFactory.js";
import { FilesystemGateway } from "../../../features/Filesystem/abstractions/FilesystemGateway.js";
import { DirectoryScanManager } from "./DirectoryScanManager.js";

class DirectoryScanManagerFactoryImpl implements Abstraction.Interface {
    public constructor(private readonly filesystemGateway: FilesystemGateway.Interface) {}

    public create(input: Abstraction.Input): Abstraction.Manager {
        return new DirectoryScanManager({
            filesystemGateway: this.filesystemGateway,
            getBrowsePath: input.getBrowsePath
        });
    }
}

export const DirectoryScanManagerFactory = Abstraction.createImplementation({
    implementation: DirectoryScanManagerFactoryImpl,
    dependencies: [FilesystemGateway]
});
