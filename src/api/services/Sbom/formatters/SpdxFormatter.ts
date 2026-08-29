import { generateId } from "@webiny/stdlib";
import { SbomFormatter as Abstraction } from "../abstractions/SbomFormatter.js";
import { sanitizeFilename } from "../sanitizeFilename.js";
import type { SbomService } from "../abstractions/SbomService.js";

interface ISpdxPackage {
    SPDXID: string;
    name: string;
    versionInfo: string;
    downloadLocation: string;
    filesAnalyzed: boolean;
    licenseConcluded: string;
    licenseDeclared: string;
    copyrightText: string;
    externalRefs: ISpdxExternalRef[];
}

interface ISpdxExternalRef {
    referenceCategory: string;
    referenceType: string;
    referenceLocator: string;
}

interface ISpdxRelationship {
    spdxElementId: string;
    relatedSpdxElement: string;
    relationshipType: string;
}

function buildSpdxId(packageName: string, version: string): string {
    const sanitized = sanitizeFilename(packageName.replace(/^@/, "").replace(/\//g, "--")).replace(
        /[^a-zA-Z0-9.-]/g,
        "-"
    );
    return `SPDXRef-Package-${sanitized}-${version}`;
}

class SpdxFormatterImpl implements Abstraction.Interface {
    public readonly name = "spdx";

    public format(data: SbomService.ProjectData): Abstraction.Result {
        const safeName = sanitizeFilename(data.projectName);

        const packages: ISpdxPackage[] = data.components.map(component => ({
            SPDXID: buildSpdxId(component.packageName, component.version),
            name: component.packageName,
            versionInfo: component.version,
            downloadLocation: "NOASSERTION",
            filesAnalyzed: false,
            licenseConcluded: component.spdxId ?? "NOASSERTION",
            licenseDeclared: component.spdxId ?? "NOASSERTION",
            copyrightText: "NOASSERTION",
            externalRefs: [
                {
                    referenceCategory: "PACKAGE-MANAGER",
                    referenceType: "purl",
                    referenceLocator: `pkg:npm/${component.packageName}@${component.version}`
                }
            ]
        }));

        const relationships: ISpdxRelationship[] = [];

        for (const spdxPackage of packages) {
            relationships.push({
                spdxElementId: "SPDXRef-DOCUMENT",
                relatedSpdxElement: spdxPackage.SPDXID,
                relationshipType: "DESCRIBES"
            });
        }

        for (const edge of data.edges) {
            if (edge.parentPackage === null) {
                continue;
            }
            relationships.push({
                spdxElementId: buildSpdxId(edge.parentPackage, edge.parentVersion ?? "0.0.0"),
                relatedSpdxElement: buildSpdxId(edge.childPackage, edge.childVersion),
                relationshipType: "DEPENDS_ON"
            });
        }

        const content: Record<string, unknown> = {
            spdxVersion: "SPDX-2.3",
            dataLicense: "CC0-1.0",
            SPDXID: "SPDXRef-DOCUMENT",
            name: data.projectName,
            documentNamespace: `https://spdx.org/spdxdocs/${safeName}-${generateId()}`,
            creationInfo: {
                created: new Date().toISOString(),
                creators: ["Tool: dependency-upgrader"],
                licenseListVersion: "3.19"
            },
            packages,
            relationships
        };

        return {
            content,
            filename: `${safeName}-spdx.json`,
            mediaType: "application/json"
        };
    }
}

export const SpdxFormatter = Abstraction.createImplementation({
    implementation: SpdxFormatterImpl,
    dependencies: []
});
