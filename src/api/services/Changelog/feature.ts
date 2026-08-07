import { createFeature } from "#shared/index.js";
import { ChangelogService } from "./ChangelogService.js";
import { GitHubReleasesResolver } from "./resolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "./resolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "./resolvers/NpmReadmeResolver.js";

export const ChangelogFeature = createFeature({
    name: "Api/ChangelogFeature",
    register(container) {
        container.register(GitHubReleasesResolver);
        container.register(ChangelogFileResolver);
        container.register(NpmReadmeResolver);
        container.register(ChangelogService).inSingletonScope();
    }
});
