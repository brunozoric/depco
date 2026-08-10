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

        return rows.join("\n");
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
