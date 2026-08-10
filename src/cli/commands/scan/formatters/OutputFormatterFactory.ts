import { OutputFormatterFactory as Abstraction } from "./abstractions/OutputFormatterFactory.js";
import type { IOutputFormatterFactoryInput } from "./abstractions/OutputFormatterFactory.js";
import type { IOutputFormatter } from "./types.js";
import { TableFormatter } from "./TableFormatter.js";
import { JsonFormatter } from "./JsonFormatter.js";

class OutputFormatterFactoryImpl implements Abstraction.Interface {
    public create(input: IOutputFormatterFactoryInput): IOutputFormatter {
        switch (input.format) {
            case "json":
                return new JsonFormatter();
            case "table":
            default:
                return new TableFormatter();
        }
    }
}

export const OutputFormatterFactory = Abstraction.createImplementation({
    implementation: OutputFormatterFactoryImpl,
    dependencies: []
});
