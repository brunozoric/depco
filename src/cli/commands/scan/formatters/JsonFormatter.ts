import type { IOutputFormatter, IScanOutput } from "./types.js";

export class JsonFormatter implements IOutputFormatter {
    public format(output: IScanOutput): string {
        return JSON.stringify(output, null, 2);
    }
}
