import { createHash } from "node:crypto";

export function hashString(input: string): string {
    return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

interface IComputeDedupKeyInput {
    cveId: string | null;
    advisoryUrl: string | null;
    packageName: string;
    title: string;
}

/**
 * Computes the stable identity key used to de-duplicate a vulnerability
 * record across the PM audit and OSV sources for the same package:
 * - Prefer the CVE id when known — it's the one identifier both sources can
 *   share, so it's what lets an audit-sourced and OSV-sourced record for the
 *   same underlying vulnerability merge into a single "both" record.
 * - Else hash the advisory URL — stable per-advisory, even without a CVE.
 * - Else hash package name + title as a last resort for advisories with
 *   neither a CVE id nor a URL.
 */
export function computeDedupKey(input: IComputeDedupKeyInput): string {
    if (input.cveId) {
        return input.cveId;
    }
    if (input.advisoryUrl) {
        return hashString(input.advisoryUrl);
    }
    return hashString(`${input.packageName}:${input.title}`);
}

interface IMergeMapKeyInput {
    packageName: string;
    dedupKey: string;
}

export function mergeMapKey(input: IMergeMapKeyInput): string {
    return `${input.packageName}::${input.dedupKey}`;
}
