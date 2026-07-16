import { createAbstraction } from "#shared/index.js";

export interface IChangelogResolver {
    readonly name: string;
    resolve(
        packageName: string,
        repoUrl: string | null,
        versions: string[],
        repoDirectory?: string | null
    ): Promise<Map<string, string>>;
}

export const ChangelogResolver = createAbstraction<IChangelogResolver>("Api/ChangelogResolver");

export namespace ChangelogResolver {
    export type Interface = IChangelogResolver;
}
