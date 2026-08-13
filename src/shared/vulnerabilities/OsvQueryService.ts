import { OsvQueryService as Abstraction } from "./abstractions/OsvQueryService.js";
import type {
    IOsvAdvisory,
    IOsvQueryBatchInput,
    IOsvQueryInput
} from "./abstractions/OsvQueryService.js";
import {
    osvBatchResponseSchema,
    osvVulnerabilityDetailSchema,
    hasInlineDetail,
    toDetailFromInlineRef
} from "./OsvSchemas.js";
import type { IOsvBatchVulnRef, IOsvVulnerabilityDetail } from "./OsvSchemas.js";
import { toAdvisory } from "./OsvAdvisoryTransform.js";

export { parseCvssV3Vector, parseCvssV2Vector } from "./CvssScoring.js";
export { osvVulnerabilityDetailSchema } from "./OsvSchemas.js";
export type { IOsvVulnerabilityDetail } from "./OsvSchemas.js";

export const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
export const OSV_VULNERABILITY_URL = "https://api.osv.dev/v1/vulns";
const OSV_FETCH_CONCURRENCY = 5;

async function mapWithConcurrency<TInput, TOutput>(
    items: TInput[],
    concurrency: number,
    fn: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
    const results: TOutput[] = new Array(items.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await fn(items[index]!);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}

function buildQueryKey(pkg: IOsvQueryInput): string {
    return `${pkg.name}@${pkg.version}`;
}

class OsvQueryServiceImpl implements Abstraction.Interface {
    /**
     * Queries OSV.dev for vulnerabilities affecting the given packages.
     *
     * Deliberately does NOT catch network/parse errors — this is a thin,
     * transparent API client, and callers must decide how to react to a
     * failed query. Swallowing errors here would mean a transient OSV
     * outage silently resolves to "no vulnerabilities found" for every
     * caller, including the server-side `OsvCacheService`, which would then
     * persist that empty result to its cache for the full TTL — a false
     * "all clear" that is a security regression, not graceful degradation.
     * Graceful degradation (if wanted) belongs in the caller, which has the
     * context to decide whether "OSV is down" should surface as an error,
     * a warning, or a skip.
     */
    public async queryBatch(input: IOsvQueryBatchInput): Promise<Map<string, IOsvAdvisory[]>> {
        const result = new Map<string, IOsvAdvisory[]>();
        if (input.packages.length === 0) {
            return result;
        }

        const refsByIndex = await this.queryOsvBatch(input.packages);
        const detailById = await this.resolveVulnerabilityDetails(refsByIndex);

        input.packages.forEach((pkg, index) => {
            const refs = refsByIndex[index] ?? [];
            const advisories = refs
                .map(ref => detailById.get(ref.id))
                .filter((detail): detail is IOsvVulnerabilityDetail => detail !== undefined)
                .map(detail => toAdvisory({ detail, packageName: pkg.name }));

            result.set(buildQueryKey(pkg), advisories);
        });

        return result;
    }

    private async queryOsvBatch(packages: IOsvQueryInput[]): Promise<IOsvBatchVulnRef[][]> {
        const response = await fetch(OSV_BATCH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                queries: packages.map(pkg => ({
                    package: { name: pkg.name, ecosystem: "npm" },
                    version: pkg.version
                }))
            })
        });

        if (!response.ok) {
            throw new Error(
                `OSV batch query failed for ${packages.length} package(s): ` +
                    `${response.status} ${response.statusText}`
            );
        }

        const parsed = osvBatchResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
            throw new Error(JSON.stringify(parsed.error.issues));
        }
        const data = parsed.data;
        return packages.map((_pkg, index) => data.results[index]?.vulns ?? []);
    }

    private async resolveVulnerabilityDetails(
        refsByIndex: IOsvBatchVulnRef[][]
    ): Promise<Map<string, IOsvVulnerabilityDetail>> {
        const detailById = new Map<string, IOsvVulnerabilityDetail>();
        const idsNeedingFetch = new Set<string>();

        for (const refs of refsByIndex) {
            for (const ref of refs) {
                if (hasInlineDetail(ref)) {
                    detailById.set(ref.id, toDetailFromInlineRef(ref));
                } else if (!detailById.has(ref.id)) {
                    idsNeedingFetch.add(ref.id);
                }
            }
        }
        for (const id of detailById.keys()) {
            idsNeedingFetch.delete(id);
        }

        if (idsNeedingFetch.size > 0) {
            await mapWithConcurrency(
                Array.from(idsNeedingFetch),
                OSV_FETCH_CONCURRENCY,
                async id => {
                    const response = await fetch(`${OSV_VULNERABILITY_URL}/${id}`);
                    if (response.ok) {
                        const parsed = osvVulnerabilityDetailSchema.safeParse(
                            await response.json()
                        );
                        if (!parsed.success) {
                            throw new Error(JSON.stringify(parsed.error.issues));
                        }
                        detailById.set(id, parsed.data);
                    }
                }
            );
        }

        return detailById;
    }
}

export const OsvQueryService = Abstraction.createImplementation({
    implementation: OsvQueryServiceImpl,
    dependencies: []
});
