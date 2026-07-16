import { FilesystemGateway as Abstraction } from "./abstractions/FilesystemGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import { browseFilesystemRoute, scanFilesystemRoute } from "#shared/routes/index.js";

class FilesystemGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async browse(path?: string, showHidden?: boolean): Promise<Abstraction.BrowseResult> {
        const query: Record<string, string> = {};
        if (path) {
            query["path"] = path;
        }
        if (showHidden) {
            query["showHidden"] = "true";
        }

        const response = await this.httpClient.request(browseFilesystemRoute, {
            params: {},
            query: Object.keys(query).length > 0 ? query : undefined
        });

        return { items: response.items, currentPath: response.currentPath };
    }

    public async scan(path: string, depth?: number): Promise<Abstraction.ScanResult> {
        const response = await this.httpClient.request(scanFilesystemRoute, {
            params: {},
            query: { path, depth: depth !== undefined && depth > 1 ? depth : 1 }
        });

        return {
            items: response.items,
            scannedPath: response.scannedPath,
            scannedCount: response.scannedCount,
            filteredCount: response.filteredCount,
            total: response.total,
            mode: response.mode
        };
    }
}

export const FilesystemGateway = Abstraction.createImplementation({
    implementation: FilesystemGatewayImpl,
    dependencies: [HTTPClient]
});
