import { SbomFormatterRegistry as Abstraction } from "./abstractions/SbomFormatterRegistry.js";
import { SbomFormatter } from "./abstractions/SbomFormatter.js";

class SbomFormatterRegistryImpl implements Abstraction.Interface {
    public constructor(private readonly formatters: SbomFormatter.Interface[]) {}

    public get(format: string): Abstraction.Formatter {
        const formatter = this.formatters.find(f => f.name === format);
        if (!formatter) {
            throw new Error(`Unknown SBOM format: ${format}`);
        }
        return formatter;
    }
}

export const SbomFormatterRegistry = Abstraction.createImplementation({
    implementation: SbomFormatterRegistryImpl,
    dependencies: [[SbomFormatter, { multiple: true }]]
});
