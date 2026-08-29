import { generateId } from "@webiny/stdlib";
import { SbomFormatter } from "../abstractions/SbomFormatter.js";
import { sanitizeFilename } from "../sanitizeFilename.js";
import type { SbomService } from "../abstractions/SbomService.js";

interface ICycloneDxComponent {
    type: string;
    name: string;
    version: string;
    purl: string;
    "bom-ref": string;
    licenses: ICycloneDxLicense[];
}

interface ICycloneDxLicenseReference {
    id: string;
}

interface ICycloneDxLicense {
    license: ICycloneDxLicenseReference;
}

interface ICycloneDxVulnerabilitySource {
    name: string;
    url: string;
}

interface ICycloneDxVulnerabilityRating {
    severity: string;
    method: string;
}

interface ICycloneDxAffectedComponentReference {
    ref: string;
}

interface ICycloneDxVulnerability {
    id: string;
    source: ICycloneDxVulnerabilitySource;
    ratings: ICycloneDxVulnerabilityRating[];
    affects: ICycloneDxAffectedComponentReference[];
}

interface ICycloneDxDependency {
    ref: string;
    dependsOn: string[];
}

function buildPurl(packageName: string, version: string): string {
    return `pkg:npm/${packageName}@${version}`;
}

class CycloneDxFormatterImpl implements SbomFormatter.Interface {
    public readonly name = "cyclonedx";

    public format(data: SbomService.ProjectData): SbomFormatter.Result {
        const safeName = sanitizeFilename(data.projectName);

        const components: ICycloneDxComponent[] = data.components.map(component => {
            const purl = buildPurl(component.packageName, component.version);
            const componentLicenses: ICycloneDxLicense[] = component.spdxId
                ? [{ license: { id: component.spdxId } }]
                : [];

            return {
                type: "library",
                name: component.packageName,
                version: component.version,
                purl,
                "bom-ref": purl,
                licenses: componentLicenses
            };
        });

        const vulnerabilityEntries: ICycloneDxVulnerability[] = data.vulnerabilities.map(
            vulnerability => ({
                id: vulnerability.advisoryId,
                source: { name: vulnerability.source, url: vulnerability.advisoryUrl ?? "" },
                ratings: [{ severity: vulnerability.severity, method: "other" }],
                affects: [{ ref: `pkg:npm/${vulnerability.packageName}` }]
            })
        );

        const dependencyMap = new Map<string, Set<string>>();
        const projectRef = buildPurl(data.projectName, "0.0.0");

        for (const edge of data.edges) {
            const parentRef =
                edge.parentPackage === null
                    ? projectRef
                    : buildPurl(edge.parentPackage, edge.parentVersion ?? "0.0.0");
            const childRef = buildPurl(edge.childPackage, edge.childVersion);

            const existing = dependencyMap.get(parentRef) ?? new Set<string>();
            existing.add(childRef);
            dependencyMap.set(parentRef, existing);
        }

        const dependencyEntries: ICycloneDxDependency[] = [...dependencyMap.entries()].map(
            ([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn] })
        );

        const content: Record<string, unknown> = {
            bomFormat: "CycloneDX",
            specVersion: "1.5",
            serialNumber: `urn:uuid:${generateId()}`,
            version: 1,
            metadata: {
                timestamp: new Date().toISOString(),
                tools: [
                    { vendor: "dependency-upgrader", name: "dependency-upgrader", version: "1.0.0" }
                ],
                component: {
                    type: "application",
                    "bom-ref": projectRef,
                    name: data.projectName,
                    version: "0.0.0"
                }
            },
            components,
            dependencies: dependencyEntries,
            vulnerabilities: vulnerabilityEntries
        };

        return {
            content,
            filename: `${safeName}-cyclonedx.json`,
            mediaType: "application/json"
        };
    }
}

export const CycloneDxFormatter = SbomFormatter.createImplementation({
    implementation: CycloneDxFormatterImpl,
    dependencies: []
});
