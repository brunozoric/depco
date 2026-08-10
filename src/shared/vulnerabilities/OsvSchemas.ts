import { z } from "zod";

// ---------------------------------------------------------------------------
// OSV.dev response shapes.
//
// `POST /v1/querybatch` normally returns minimal `{ id, modified }` refs per
// vulnerability (verified against the live API) — no summary/severity/
// affected data. Full advisory details must be fetched per-id from
// `GET /v1/vulns/:id`. The batch-ref schema below therefore leaves the rich
// fields (`summary`/`severity`/`aliases`/`affected`) undefined rather than
// defaulted, so `hasInlineDetail()` can tell a bare ref apart from a fully
// self-describing entry and skip the redundant per-id fetch when the batch
// response already carries everything needed.
// ---------------------------------------------------------------------------

const osvSeverityEntrySchema = z.object({ type: z.string(), score: z.string() });

const osvAffectedEventSchema = z.object({
    introduced: z.string().optional(),
    fixed: z.string().optional(),
    last_affected: z.string().optional()
});

const osvAffectedRangeSchema = z.object({
    events: z.array(osvAffectedEventSchema).optional().default([])
});

const osvAffectedEntrySchema = z.object({
    package: z.object({ name: z.string() }).optional(),
    ranges: z.array(osvAffectedRangeSchema).optional().default([])
});

const osvReferenceSchema = z.object({
    type: z.string().optional().default("WEB"),
    url: z.string()
});

export const osvVulnerabilityDetailSchema = z.object({
    id: z.string(),
    summary: z.string().optional(),
    details: z.string().optional(),
    severity: z.array(osvSeverityEntrySchema).optional().default([]),
    aliases: z.array(z.string()).optional().default([]),
    affected: z.array(osvAffectedEntrySchema).optional().default([]),
    references: z.array(osvReferenceSchema).optional().default([])
});

export type IOsvVulnerabilityDetail = z.infer<typeof osvVulnerabilityDetailSchema>;
export type IOsvSeverityEntry = z.infer<typeof osvSeverityEntrySchema>;
export type IOsvAffectedEntry = z.infer<typeof osvAffectedEntrySchema>;
export type IOsvAffectedRange = IOsvAffectedEntry["ranges"][number];

const osvBatchVulnRefSchema = z.object({
    id: z.string(),
    summary: z.string().optional(),
    severity: z.array(osvSeverityEntrySchema).optional(),
    aliases: z.array(z.string()).optional(),
    affected: z.array(osvAffectedEntrySchema).optional()
});

export type IOsvBatchVulnRef = z.infer<typeof osvBatchVulnRefSchema>;

export const osvBatchResponseSchema = z.object({
    results: z
        .array(
            z.object({
                vulns: z.array(osvBatchVulnRefSchema).optional().default([])
            })
        )
        .optional()
        .default([])
});

export function hasInlineDetail(ref: IOsvBatchVulnRef): boolean {
    return (
        ref.summary !== undefined ||
        ref.severity !== undefined ||
        ref.aliases !== undefined ||
        ref.affected !== undefined
    );
}

export function toDetailFromInlineRef(ref: IOsvBatchVulnRef): IOsvVulnerabilityDetail {
    return {
        id: ref.id,
        summary: ref.summary,
        details: undefined,
        severity: ref.severity ?? [],
        aliases: ref.aliases ?? [],
        affected: ref.affected ?? [],
        references: []
    };
}
