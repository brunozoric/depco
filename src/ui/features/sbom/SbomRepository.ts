import { SbomRepository as Abstraction } from "./abstractions/SbomRepository.js";

class SbomRepositoryImpl implements Abstraction.Interface {
    private lastExport: Abstraction.LastExport | null = null;

    public getLastExport(): Abstraction.LastExport | null {
        return this.lastExport;
    }

    public setLastExport(lastExport: Abstraction.LastExport): void {
        this.lastExport = lastExport;
    }
}

export const SbomRepository = Abstraction.createImplementation({
    implementation: SbomRepositoryImpl,
    dependencies: []
});
