import { createFeature } from "#shared/index.js";
import { ChangelogsGateway } from "./ChangelogsGateway.js";

export const ChangelogsFeature = createFeature({
    name: "Ui/Changelogs",
    register(container) {
        container.register(ChangelogsGateway).inSingletonScope();
    }
});
