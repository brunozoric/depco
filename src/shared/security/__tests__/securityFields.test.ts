import { describe, it, expect } from "vitest";
import {
    YARN_SECURITY_FIELDS,
    NPM_SECURITY_FIELDS,
    PNPM_SECURITY_FIELDS,
    BUN_SECURITY_FIELDS,
    SECURITY_FIELD_REGISTRY
} from "#shared/security/index.js";

function yarnField(name: string) {
    return YARN_SECURITY_FIELDS.find(f => f.fieldName === name)!;
}

function npmField(name: string) {
    return NPM_SECURITY_FIELDS.find(f => f.fieldName === name)!;
}

function pnpmField(name: string) {
    return PNPM_SECURITY_FIELDS.find(f => f.fieldName === name)!;
}

describe("YARN_SECURITY_FIELDS", () => {
    describe("npmPreapprovedPackages", () => {
        const field = yarnField("npmPreapprovedPackages");

        it("compare returns true when value is an empty array", () => {
            expect(field.compare([], "exists")).toBe(true);
        });

        it("compare returns true when value is a non-empty array", () => {
            expect(field.compare(["left-pad", "react-*"], "exists")).toBe(true);
        });

        it("compare returns false when value is null", () => {
            expect(field.compare(null, "exists")).toBe(false);
        });

        it("compare returns false when value is undefined", () => {
            expect(field.compare(undefined, "exists")).toBe(false);
        });

        it("compare returns false when value is a string", () => {
            expect(field.compare("left-pad", "exists")).toBe(false);
        });
    });

    describe("npmMinimalAgeGate", () => {
        const field = yarnField("npmMinimalAgeGate");

        it('compare returns true when actual "3d" >= expected "3d"', () => {
            expect(field.compare("3d", "3d")).toBe(true);
        });

        it('compare returns true when actual "7d" >= expected "3d"', () => {
            expect(field.compare("7d", "3d")).toBe(true);
        });

        it('compare returns false when actual "1d" < expected "3d"', () => {
            expect(field.compare("1d", "3d")).toBe(false);
        });

        it("compare returns false when actual is null", () => {
            expect(field.compare(null, "3d")).toBe(false);
        });

        it('compare returns false when actual is invalid string "abc"', () => {
            expect(field.compare("abc", "3d")).toBe(false);
        });

        it('expectedValueSchema rejects "3x"', () => {
            expect(field.expectedValueSchema.safeParse("3x").success).toBe(false);
        });

        it('expectedValueSchema rejects ""', () => {
            expect(field.expectedValueSchema.safeParse("").success).toBe(false);
        });

        it('expectedValueSchema accepts "72h"', () => {
            expect(field.expectedValueSchema.safeParse("72h").success).toBe(true);
        });
    });

    describe("enableScripts", () => {
        const field = yarnField("enableScripts");

        it('compare returns true when actual false matches expected "false"', () => {
            expect(field.compare(false, "false")).toBe(true);
        });

        it('compare returns true when actual is string "false" and expected is "false"', () => {
            expect(field.compare("false", "false")).toBe(true);
        });

        it('compare returns false when actual is true and expected is "false"', () => {
            expect(field.compare(true, "false")).toBe(false);
        });

        it("compare returns false when actual is null", () => {
            expect(field.compare(null, "false")).toBe(false);
        });

        it('expectedValueSchema rejects "maybe"', () => {
            expect(field.expectedValueSchema.safeParse("maybe").success).toBe(false);
        });

        it('expectedValueSchema accepts "true"', () => {
            expect(field.expectedValueSchema.safeParse("true").success).toBe(true);
        });

        it('expectedValueSchema accepts "false"', () => {
            expect(field.expectedValueSchema.safeParse("false").success).toBe(true);
        });
    });

    describe("approvedGitRepositories", () => {
        const field = yarnField("approvedGitRepositories");

        it("compare returns true when value is an empty array", () => {
            expect(field.compare([], "exists")).toBe(true);
        });

        it("compare returns false when value is null", () => {
            expect(field.compare(null, "exists")).toBe(false);
        });

        it("compare returns false when value is undefined", () => {
            expect(field.compare(undefined, "exists")).toBe(false);
        });
    });
});

describe("NPM_SECURITY_FIELDS", () => {
    describe.each(["ignore-scripts", "audit", "strict-ssl"])("%s", fieldName => {
        const field = npmField(fieldName);

        it('compare returns true when actual "true" and expected "true"', () => {
            expect(field.compare("true", "true")).toBe(true);
        });

        it('compare returns false when actual "false" and expected "true"', () => {
            expect(field.compare("false", "true")).toBe(false);
        });

        it("compare returns false when actual is null", () => {
            expect(field.compare(null, "true")).toBe(false);
        });
    });

    describe("ignore-scripts", () => {
        const field = npmField("ignore-scripts");

        it('expectedValueSchema rejects "maybe"', () => {
            expect(field.expectedValueSchema.safeParse("maybe").success).toBe(false);
        });
    });
});

describe("PNPM_SECURITY_FIELDS", () => {
    describe.each([
        "ignoreScripts",
        "strictSsl",
        "strictPeerDependencies",
        "minimumReleaseAgeStrict",
        "strictDepBuilds",
        "blockExoticSubdeps"
    ])("%s", fieldName => {
        const field = pnpmField(fieldName);

        it("reads from pnpm-workspace.yaml", () => {
            expect(field.configFile).toBe("pnpm-workspace.yaml");
        });

        it('compare returns true when actual true and expected "true"', () => {
            expect(field.compare(true, "true")).toBe(true);
        });

        it('compare returns true when actual "true" and expected "true"', () => {
            expect(field.compare("true", "true")).toBe(true);
        });

        it('compare returns false when actual false and expected "true"', () => {
            expect(field.compare(false, "true")).toBe(false);
        });

        it("compare returns false when actual is null", () => {
            expect(field.compare(null, "true")).toBe(false);
        });
    });

    describe("strictPeerDependencies", () => {
        const field = pnpmField("strictPeerDependencies");

        it('expectedValueSchema rejects "maybe"', () => {
            expect(field.expectedValueSchema.safeParse("maybe").success).toBe(false);
        });
    });

    describe("minimumReleaseAge", () => {
        const field = pnpmField("minimumReleaseAge");

        it("reads from pnpm-workspace.yaml", () => {
            expect(field.configFile).toBe("pnpm-workspace.yaml");
        });

        it("compare returns true when minutes value meets threshold", () => {
            expect(field.compare(4320, "4320")).toBe(true);
        });

        it("compare returns true when minutes value exceeds threshold", () => {
            expect(field.compare(5760, "4320")).toBe(true);
        });

        it("compare returns false when minutes value below threshold", () => {
            expect(field.compare(1440, "4320")).toBe(false);
        });

        it("compare returns false when actual is non-numeric string", () => {
            expect(field.compare("3d", "4320")).toBe(false);
        });

        it("compare returns false when actual is null", () => {
            expect(field.compare(null, "4320")).toBe(false);
        });

        it('expectedValueSchema rejects "abc"', () => {
            expect(field.expectedValueSchema.safeParse("abc").success).toBe(false);
        });

        it('expectedValueSchema rejects duration format "3d"', () => {
            expect(field.expectedValueSchema.safeParse("3d").success).toBe(false);
        });

        it('expectedValueSchema accepts "4320"', () => {
            expect(field.expectedValueSchema.safeParse("4320").success).toBe(true);
        });
    });
});

describe("BUN_SECURITY_FIELDS", () => {
    function bunField(name: string) {
        return BUN_SECURITY_FIELDS.find(f => f.fieldName === name)!;
    }

    describe("trustedDependencies", () => {
        const field = bunField("trustedDependencies");

        it("compare returns true when value is an empty array", () => {
            expect(field.compare([], "exists")).toBe(true);
        });

        it("compare returns true when value is a non-empty array", () => {
            expect(field.compare(["esbuild"], "exists")).toBe(true);
        });

        it("compare returns false when value is null", () => {
            expect(field.compare(null, "exists")).toBe(false);
        });

        it("compare returns false when value is undefined", () => {
            expect(field.compare(undefined, "exists")).toBe(false);
        });
    });

    describe.each(["install.exact", "install.frozen"])("%s", fieldName => {
        const field = bunField(fieldName);

        it('compare returns true when actual true and expected "true"', () => {
            expect(field.compare(true, "true")).toBe(true);
        });

        it('compare returns false when actual false and expected "true"', () => {
            expect(field.compare(false, "true")).toBe(false);
        });

        it("compare returns false when actual is null", () => {
            expect(field.compare(null, "true")).toBe(false);
        });

        it('expectedValueSchema rejects "maybe"', () => {
            expect(field.expectedValueSchema.safeParse("maybe").success).toBe(false);
        });

        it('expectedValueSchema accepts "true"', () => {
            expect(field.expectedValueSchema.safeParse("true").success).toBe(true);
        });
    });

    it("should contain 8 fields total", () => {
        expect(BUN_SECURITY_FIELDS).toHaveLength(8);
    });

    describe("install.saveTextLockfile", () => {
        const field = bunField("install.saveTextLockfile");

        it("should exist", () => {
            expect(field).toBeDefined();
            expect(field.configFile).toBe("bunfig.toml");
            expect(field.inputType).toBe("boolean");
            expect(field.defaultExpectedValue).toBe("true");
        });

        it("should compare boolean values", () => {
            expect(field.compare(true, "true")).toBe(true);
            expect(field.compare(false, "true")).toBe(false);
            expect(field.compare(null, "true")).toBe(false);
        });
    });

    describe("install.production", () => {
        const field = bunField("install.production");

        it("should exist", () => {
            expect(field).toBeDefined();
            expect(field.configFile).toBe("bunfig.toml");
            expect(field.inputType).toBe("boolean");
            expect(field.defaultExpectedValue).toBe("false");
        });

        it("should compare boolean values", () => {
            expect(field.compare(false, "false")).toBe(true);
            expect(field.compare(true, "false")).toBe(false);
            expect(field.compare(null, "false")).toBe(false);
        });
    });

    describe("install.peer", () => {
        const field = bunField("install.peer");

        it("should exist with default true", () => {
            expect(field).toBeDefined();
            expect(field.defaultExpectedValue).toBe("true");
        });
    });

    describe("install.optional", () => {
        const field = bunField("install.optional");

        it("should exist with default true", () => {
            expect(field).toBeDefined();
            expect(field.defaultExpectedValue).toBe("true");
        });
    });

    describe("install.auto", () => {
        const field = bunField("install.auto");

        it("should exist with default false", () => {
            expect(field).toBeDefined();
            expect(field.defaultExpectedValue).toBe("false");
        });
    });
});

describe("SECURITY_FIELD_REGISTRY", () => {
    it("maps yarn to 4 fields", () => {
        expect(SECURITY_FIELD_REGISTRY.yarn).toHaveLength(4);
    });

    it("maps npm to 4 fields", () => {
        expect(SECURITY_FIELD_REGISTRY.npm).toHaveLength(4);
    });

    it("maps pnpm to 7 fields", () => {
        expect(SECURITY_FIELD_REGISTRY.pnpm).toHaveLength(7);
    });

    it("maps bun to 8 fields", () => {
        expect(SECURITY_FIELD_REGISTRY.bun).toHaveLength(8);
    });

    it("every field has required shape properties", () => {
        const allFields = [
            ...SECURITY_FIELD_REGISTRY.yarn,
            ...SECURITY_FIELD_REGISTRY.npm,
            ...SECURITY_FIELD_REGISTRY.pnpm,
            ...SECURITY_FIELD_REGISTRY.bun
        ];

        for (const field of allFields) {
            expect(typeof field.fieldName).toBe("string");
            expect(typeof field.configFile).toBe("string");
            expect(typeof field.description).toBe("string");
            expect(typeof field.helperText).toBe("string");
            expect(typeof field.inputType).toBe("string");
            expect(typeof field.expectedValueSchema).toBe("object");
            expect(typeof field.expectedValueSchema.parse).toBe("function");
            expect(typeof field.defaultExpectedValue).toBe("string");
            expect(typeof field.compare).toBe("function");
        }
    });
});
