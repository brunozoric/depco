import type { IDepcoConfig } from "#shared/config/types.js";

const config: IDepcoConfig = {
    scan: {
        license: {
            allowedRiskTiers: ["permissive"],
            ignoredPackages: []
        },
        vulnerability: {
            maxSeverity: "high",
            ignoredPackages: []
        },
        ignoredPackages: [],
        registryUrl: "https://registry.npmjs.org"
    }
};

export default config;
