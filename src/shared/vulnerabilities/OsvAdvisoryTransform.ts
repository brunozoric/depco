import { mapCvssScoreToSeverity } from "./mapCvssScoreToSeverity.js";
import type { IOsvAdvisory } from "./abstractions/OsvQueryService.js";
import type { VulnerabilitySeverity } from "./types.js";
import type {
    IOsvVulnerabilityDetail,
    IOsvSeverityEntry,
    IOsvAffectedRange
} from "./OsvSchemas.js";
import { parseCvssV3Vector, parseCvssV2Vector } from "./CvssScoring.js";

function resolveSeverity(entries: IOsvSeverityEntry[]): VulnerabilitySeverity {
    const v3 = entries.find(entry => entry.type === "CVSS_V3");
    const v2 = entries.find(entry => entry.type === "CVSS_V2");

    const score = v3 ? parseCvssV3Vector(v3.score) : v2 ? parseCvssV2Vector(v2.score) : null;
    return score === null ? "info" : mapCvssScoreToSeverity(score);
}

function buildVulnerableRange(ranges: IOsvAffectedRange[]): string | null {
    const segments: string[] = [];

    for (const range of ranges) {
        const parts: string[] = [];
        for (const event of range.events) {
            if (event.introduced !== undefined && event.introduced !== "0") {
                parts.push(`>=${event.introduced}`);
            }
            if (event.fixed !== undefined) {
                parts.push(`<${event.fixed}`);
            }
            if (event.last_affected !== undefined) {
                parts.push(`<=${event.last_affected}`);
            }
        }
        if (parts.length > 0) {
            segments.push(parts.join(" "));
        }
    }

    return segments.length > 0 ? segments.join(" || ") : null;
}

function extractFixVersion(ranges: IOsvAffectedRange[]): string | null {
    for (const range of ranges) {
        for (const event of range.events) {
            if (event.fixed !== undefined) {
                return event.fixed;
            }
        }
    }
    return null;
}

interface IToAdvisoryInput {
    detail: IOsvVulnerabilityDetail;
    packageName: string;
}

export function toAdvisory(input: IToAdvisoryInput): IOsvAdvisory {
    const matchingAffected = input.detail.affected.filter(
        entry => entry.package?.name === input.packageName
    );
    const ranges = matchingAffected.flatMap(entry => entry.ranges);

    return {
        id: input.detail.id,
        summary: input.detail.summary ?? null,
        severity: resolveSeverity(input.detail.severity),
        aliases: input.detail.aliases,
        advisoryUrl: `https://osv.dev/vulnerability/${input.detail.id}`,
        vulnerableRange: buildVulnerableRange(ranges),
        fixVersion: extractFixVersion(ranges)
    };
}
