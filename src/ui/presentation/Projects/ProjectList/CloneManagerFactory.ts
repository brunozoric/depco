import { CloneManagerFactory as Abstraction } from "./abstractions/CloneManagerFactory.js";
import { CloneProjectUseCase } from "../useCases/abstractions/CloneProjectUseCase.js";
import { CloneManager } from "./CloneManager.js";

class CloneManagerFactoryImpl implements Abstraction.Interface {
    public constructor(private readonly cloneProjectUseCase: CloneProjectUseCase.Interface) {}

    public create(input: Abstraction.Input): Abstraction.Manager {
        return new CloneManager({
            cloneProjectUseCase: this.cloneProjectUseCase,
            getBrowsePath: input.getBrowsePath,
            onCloned: input.onCloned
        });
    }
}

export const CloneManagerFactory = Abstraction.createImplementation({
    implementation: CloneManagerFactoryImpl,
    dependencies: [CloneProjectUseCase]
});
