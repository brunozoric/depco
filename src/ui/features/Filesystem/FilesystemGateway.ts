import { FilesystemGateway as Abstraction } from "./abstractions/FilesystemGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { browseFilesystemRoute, scanFilesystemRoute } from "#shared/routes/index.js";
import { cleanQueryRecord } from "../../infrastructure/HttpClient/cleanQuery.js";

class FilesystemGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async browse(path?: string, showHidden?: boolean): Promise<Abstraction.BrowseResult> {
        const query = cleanQueryRecord({
            path,
            showHidden: showHidden ? "true" : undefined
        });

        const response = await this.httpClient.request(browseFilesystemRoute, {
            params: {},
            query
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
