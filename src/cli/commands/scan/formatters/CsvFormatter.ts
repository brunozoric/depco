import type { EngineStatus } from "#shared/engines/types.js";
import type { IOutputFormatter, IScanOutput } from "./types.js";

const CSV_HEADER = "type,package,version,detail,severity,source,fixVersion";

interface ICsvRow {
    type: string;
    packageName: string;
    version: string;
    detail: string;
    severity: string;
    source: string;
    fixVersion: string;
}

export class CsvFormatter implements IOutputFormatter {
    public format(output: IScanOutput): string {
        const rows: string[] = [CSV_HEADER];

        for (const violation of output.findings.license) {
            rows.push(
                this.formatRow({
                    type: "license",
                    packageName: violation.packageName,
                    version: violation.version,
                    detail: violation.license,
                    severity: violation.riskTier,
                    source: "",
                    fixVersion: ""
                })
            );
        }

        for (const vulnerability of output.findings.vulnerability) {
            rows.push(
                this.formatRow({
                    type: "vulnerability",
                    packageName: vulnerability.packageName,
                    version: vulnerability.installedVersion,
                    detail: vulnerability.cveId ?? vulnerability.dedupKey,
                    severity: vulnerability.severity,
                    source: vulnerability.source,
                    fixVersion: vulnerability.fixVersion ?? ""
                })
            );
        }

        for (const finding of output.findings.engines) {
            rows.push(
                this.formatRow({
                    type: "engines",
                    packageName: finding.packageName,
                    version: finding.enginesNode ?? "",
                    detail: finding.status,
                    severity: this.severityForEngineStatus(finding.status),
                    source: finding.isRoot ? "root" : "dependency",
                    fixVersion: finding.eolDate
                        ? new Date(finding.eolDate).toISOString().split("T")[0]!
                        : ""
                })
            );
        }

        return rows.join("\n");
    }

    private severityForEngineStatus(status: EngineStatus): string {
        if (status === "eol") {
            return "error";
        }
        if (status === "maintenance") {
            return "warning";
        }
        return "info";
    }

    private formatRow(row: ICsvRow): string {
        return Object.values(row)
            .map(value => this.escapeValue(value))
            .join(",");
    }

    private escapeValue(value: string): string {
        if (
            value.includes(",") ||
            value.includes('"') ||
            value.includes("\n") ||
            value.includes("\r")
        ) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
