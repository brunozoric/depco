function parseCvssVectorMetrics(vector: string): Record<string, string> {
    const metrics: Record<string, string> = {};
    for (const part of vector.split("/")) {
        const [key, value] = part.split(":");
        if (key && value) {
            metrics[key] = value;
        }
    }
    return metrics;
}

function cvssV3RoundUp(value: number): number {
    const scaled = Math.round(value * 100000);
    if (scaled % 10000 === 0) {
        return scaled / 100000;
    }
    return (Math.floor(scaled / 10000) + 1) / 10;
}

const CVSS_V3_AV: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const CVSS_V3_AC: Record<string, number> = { L: 0.77, H: 0.44 };
const CVSS_V3_UI: Record<string, number> = { N: 0.85, R: 0.62 };
const CVSS_V3_CIA: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };
const CVSS_V3_PR_UNCHANGED: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const CVSS_V3_PR_CHANGED: Record<string, number> = { N: 0.85, L: 0.68, H: 0.5 };

export function parseCvssV3Vector(vector: string): number | null {
    const metrics = parseCvssVectorMetrics(vector);
    const scopeChanged = metrics["S"] === "C";
    const prTable = scopeChanged ? CVSS_V3_PR_CHANGED : CVSS_V3_PR_UNCHANGED;

    const av = CVSS_V3_AV[metrics["AV"] ?? ""];
    const ac = CVSS_V3_AC[metrics["AC"] ?? ""];
    const pr = prTable[metrics["PR"] ?? ""];
    const ui = CVSS_V3_UI[metrics["UI"] ?? ""];
    const c = CVSS_V3_CIA[metrics["C"] ?? ""];
    const i = CVSS_V3_CIA[metrics["I"] ?? ""];
    const a = CVSS_V3_CIA[metrics["A"] ?? ""];

    if (
        av === undefined ||
        ac === undefined ||
        pr === undefined ||
        ui === undefined ||
        c === undefined ||
        i === undefined ||
        a === undefined
    ) {
        return null;
    }

    const iss = 1 - (1 - c) * (1 - i) * (1 - a);
    const impact = scopeChanged
        ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
        : 6.42 * iss;

    if (impact <= 0) {
        return 0;
    }

    const exploitability = 8.22 * av * ac * pr * ui;
    const raw = scopeChanged ? 1.08 * (impact + exploitability) : impact + exploitability;
    return cvssV3RoundUp(Math.min(raw, 10));
}

const CVSS_V2_AV: Record<string, number> = { L: 0.395, A: 0.646, N: 1.0 };
const CVSS_V2_AC: Record<string, number> = { H: 0.35, M: 0.61, L: 0.71 };
const CVSS_V2_AU: Record<string, number> = { M: 0.45, S: 0.56, N: 0.704 };
const CVSS_V2_CIA: Record<string, number> = { N: 0, P: 0.275, C: 0.66 };

export function parseCvssV2Vector(vector: string): number | null {
    const metrics = parseCvssVectorMetrics(vector);

    const av = CVSS_V2_AV[metrics["AV"] ?? ""];
    const ac = CVSS_V2_AC[metrics["AC"] ?? ""];
    const au = CVSS_V2_AU[metrics["Au"] ?? ""];
    const c = CVSS_V2_CIA[metrics["C"] ?? ""];
    const i = CVSS_V2_CIA[metrics["I"] ?? ""];
    const a = CVSS_V2_CIA[metrics["A"] ?? ""];

    if (
        av === undefined ||
        ac === undefined ||
        au === undefined ||
        c === undefined ||
        i === undefined ||
        a === undefined
    ) {
        return null;
    }

    const impact = 10.41 * (1 - (1 - c) * (1 - i) * (1 - a));
    const exploitability = 20 * av * ac * au;
    const fImpact = impact === 0 ? 0 : 1.176;
    const base = (0.6 * impact + 0.4 * exploitability - 1.5) * fImpact;
    return Math.round(base * 10) / 10;
}
