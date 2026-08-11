import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { ScanCommand } from "../abstractions/ScanCommand.js";
import { StepRunner } from "../../../runner/abstractions/StepRunner.js";
import { LockfileParserService } from "#api/services/DependencyGraph/abstractions/LockfileParserService.js";
import type { IDependencyEdge } from "#api/services/DependencyGraph/abstractions/LockfileParserService.js";
import type { IPackageEntry } from "#shared/types/IPackageEntry.js";
import type { Container } from "@webiny/di";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

const FIXTURE_PACKAGES: IPackageEntry[] = [
    { name: "express", version: "4.18.2" },
    { name: "lodash", version: "4.17.21" },
    { name: "left-pad", version: "1.3.0" },
    { name: "gpl-licensed", version: "1.0.0" },
    { name: "safe-pkg", version: "2.0.0" }
];

function createMockEdges(packages: IPackageEntry[]): IDependencyEdge[] {
    return packages.map(packageEntry => ({
        parentPackage: null,
        parentVersion: null,
        childPackage: packageEntry.name,
        childVersion: packageEntry.version,
        dependencyType: "dependencies",
        depth: 1
    }));
}

function createMockLockfileParser(
    packages: IPackageEntry[] = FIXTURE_PACKAGES
): LockfileParserService.Interface {
    return {
        parse: vi.fn().mockResolvedValue(createMockEdges(packages))
    };
}

// The license lookups (CheckLicensesStep) and the OSV batch queries
// (CheckVulnerabilitiesStep, via the shared OsvQueryService) both go through
// global `fetch`. This mock services the license lookups with canned
// responses and deliberately fails every osv.dev request, so the
// vulnerability findings below come from the (mocked) audit command alone —
// this also exercises CheckVulnerabilitiesStep's graceful OSV-failure path
// (see CheckVulnerabilitiesStep.ts, the catch block around `queryOsv`).
function mockFetchLicenses(): void {
    const licenseMap: Record<string, string> = {
        express: "MIT",
        lodash: "MIT",
        "left-pad": "MIT",
        "gpl-licensed": "GPL-3.0",
        "safe-pkg": "MIT"
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("osv.dev")) {
            throw new Error("network error: osv.dev unreachable in test environment");
        }

        const packageName = Object.keys(licenseMap).find(name => url.includes(`/${name}/`));
        const license = packageName ? licenseMap[packageName] : "UNKNOWN";

        return new Response(JSON.stringify({ license }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    });
}

interface IMockVulnerability {
    name: string;
    severity: string;
    title: string;
    url: string;
}

// AuditParserService parses the audit command output differently per
// package manager (see AuditParserService.ts). DetectPackageManagerStep
// detects "yarn" from the fixture yarn.lock, so the mocked `execSync`
// output must match the NDJSON shape yarn's audit parser expects:
// one JSON line per advisory, `{ value, children: { ID, Issue, URL,
// Severity, "Vulnerable Versions" } }` (see the "yarn audit parsing"
// case in AuditParserService.test.ts).
function mockExecSync(vulnerabilities: IMockVulnerability[]): void {
    const auditOutput = vulnerabilities
        .map((vulnerability, index) =>
            JSON.stringify({
                value: vulnerability.name,
                children: {
                    ID: index + 1,
                    Issue: vulnerability.title,
                    URL: vulnerability.url,
                    Severity: vulnerability.severity,
                    "Vulnerable Versions": "<999.0.0"
                }
            })
        )
        .join("\n");

    vi.mocked(execSync).mockReturnValue(auditOutput);
}

vi.mock("node:child_process", () => ({
    execSync: vi.fn().mockReturnValue("{}")
}));

interface ISetupContainerArgs {
    packages?: IPackageEntry[];
}

function setupContainer(args: ISetupContainerArgs = {}): Container {
    const container = createTestCliContainer();
    container.registerInstance(LockfileParserService, createMockLockfileParser(args.packages));
    return container;
}

interface IRunPipelineArgs {
    container: Container;
    check?: string;
    format?: string;
}

interface IRunPipelineResult {
    runner: StepRunner.Interface;
    command: ScanCommand.Interface;
}

function runPipeline(args: IRunPipelineArgs): IRunPipelineResult {
    const runner = args.container.resolve(StepRunner);
    const command = args.container.resolve(ScanCommand);
    return { runner, command };
}

/**
 * RenderOutputStep emits the formatted scan output via a single
 * `console.log(formatter.format(output))` call — for JSON/SARIF that
 * argument is one multi-line, pretty-printed JSON string. Splitting the
 * joined console output into lines (as done for the CSV assertions, where
 * each row genuinely is one line) would slice that JSON's opening "{" onto
 * its own unparsable line, so JSON/SARIF assertions instead scan the raw
 * per-call arguments for the one whose full text is the JSON document.
 */
function findJsonConsoleCall(consoleSpy: ReturnType<typeof vi.spyOn>, marker: string): string {
    const call = consoleSpy.mock.calls
        .map((callArgs: unknown[]) => String(callArgs[0]))
        .find((text: string) => text.trim().startsWith("{") && text.includes(marker));
    if (!call) {
        throw new Error(`No console.info call found containing marker: ${marker}`);
    }
    return call;
}

interface IPackageJsonFixture {
    name?: string;
    version?: string;
    engines?: { node?: string };
}

function writePackageJsonFixture(directory: string, packageJson: IPackageJsonFixture): void {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify(packageJson));
}

describe("ScanPipeline integration", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;
    let originalExitCode: typeof process.exitCode;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        originalExitCode = process.exitCode;
        process.exitCode = undefined;
        mockFetchLicenses();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.exitCode = originalExitCode;
    });

    it("runs license check with table format", async () => {
        const container = setupContainer();
        const { runner, command } = runPipeline({ container });
        const context = command.context({ check: "license", format: "table" });
        context.dataDirectory = FIXTURES_DIR;

        await runner.run({ steps: command.steps(), context });

        const output = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
        expect(output).toContain("gpl-licensed");
        expect(output).toContain("GPL-3.0");
        expect(output).toContain("copyleft");
    });

    it("runs vulnerability check with json format", async () => {
        const container = setupContainer();
        mockExecSync([
            {
                name: "express",
                severity: "critical",
                title: "RCE in express",
                url: "https://ghsa.example/1"
            }
        ]);

        const { runner, command } = runPipeline({ container });
        const context = command.context({ check: "vulnerability", format: "json" });
        context.dataDirectory = FIXTURES_DIR;

        await runner.run({ steps: command.steps(), context });

        const jsonText = findJsonConsoleCall(consoleSpy, '"findings"');
        const parsed = JSON.parse(jsonText);
        expect(parsed.findings.vulnerability).toHaveLength(1);
        expect(parsed.findings.vulnerability[0].packageName).toBe("express");
        expect(parsed.findings.vulnerability[0].severity).toBe("critical");
    });

    it("runs all checks with csv format", async () => {
        const container = setupContainer();
        mockExecSync([
            {
                name: "lodash",
                severity: "high",
                title: "Prototype pollution",
                url: "https://ghsa.example/2"
            }
        ]);

        const { runner, command } = runPipeline({ container });
        const context = command.context({ check: "all", format: "csv" });
        context.dataDirectory = FIXTURES_DIR;

        await runner.run({ steps: command.steps(), context });

        const output = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
        const csvOutput = output
            .split("\n")
            .filter(
                (line: string) =>
                    line.startsWith("type,") ||
                    line.startsWith("license,") ||
                    line.startsWith("vulnerability,")
            )
            .join("\n");

        expect(csvOutput).toContain("type,package,version,detail,severity,source,fixVersion");
        expect(csvOutput).toContain("license,gpl-licensed");
        expect(csvOutput).toContain("vulnerability,lodash");
    });

    it("outputs valid sarif format", async () => {
        const container = setupContainer();
        mockExecSync([
            { name: "express", severity: "critical", title: "RCE", url: "https://ghsa.example/3" }
        ]);

        const { runner, command } = runPipeline({ container });
        const context = command.context({ check: "all", format: "sarif" });
        context.dataDirectory = FIXTURES_DIR;

        await runner.run({ steps: command.steps(), context });

        const sarifText = findJsonConsoleCall(consoleSpy, '"$schema"');
        const sarif = JSON.parse(sarifText);
        expect(sarif.version).toBe("2.1.0");
        expect(sarif.runs).toHaveLength(1);
        expect(sarif.runs[0].results.length).toBeGreaterThan(0);
    });

    it("sets exit code 1 on license violations", async () => {
        const container = setupContainer();
        const { runner, command } = runPipeline({ container });
        const context = command.context({ check: "license", format: "table" });
        context.dataDirectory = FIXTURES_DIR;

        await runner.run({ steps: command.steps(), context });

        expect(process.exitCode).toBe(1);
    });

    it("sets exit code 1 when vulnerability exceeds maxSeverity threshold", async () => {
        // CheckLicensesStep has no `check` option gate — it always runs
        // regardless of `--check`. Excluding gpl-licensed (the only package
        // whose license fails the fixture config's allowedRiskTiers) keeps
        // the license-violation branch of applyExitCode from firing, so the
        // exit code observed here can only come from the vulnerability
        // severity-threshold branch being under test.
        const container = setupContainer({
            packages: FIXTURE_PACKAGES.filter(packageEntry => packageEntry.name !== "gpl-licensed")
        });
        mockExecSync([
            { name: "express", severity: "critical", title: "RCE", url: "https://ghsa.example/4" }
        ]);

        const { runner, command } = runPipeline({ container });
        const context = command.context({ check: "vulnerability", format: "table" });
        context.dataDirectory = FIXTURES_DIR;

        await runner.run({ steps: command.steps(), context });

        // maxSeverity is "high" in fixture config, critical exceeds it
        expect(process.exitCode).toBe(1);
    });

    it("completes pipeline when OSV query fails", async () => {
        const container = setupContainer();
        mockExecSync([
            {
                name: "express",
                severity: "high",
                title: "Known issue",
                url: "https://ghsa.example/5"
            }
        ]);

        // OSV fails for every request (mockFetchLicenses throws for osv.dev
        // URLs above). CheckVulnerabilitiesStep catches OSV errors and
        // continues with audit-only results.

        const { runner, command } = runPipeline({ container });
        const context = command.context({ check: "all", format: "json" });
        context.dataDirectory = FIXTURES_DIR;

        // Pipeline should not throw
        await expect(runner.run({ steps: command.steps(), context })).resolves.toBeUndefined();

        const output = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
        expect(output).toContain("express");
    });

    describe("engines check", () => {
        let enginesProjectDirectory: string;

        beforeEach(() => {
            enginesProjectDirectory = mkdtempSync(join(tmpdir(), "scan-pipeline-engines-"));
            writeFileSync(join(enginesProjectDirectory, "yarn.lock"), "");
            writePackageJsonFixture(enginesProjectDirectory, {
                name: "engines-root",
                version: "1.0.0",
                engines: { node: ">=16" }
            });
            writePackageJsonFixture(join(enginesProjectDirectory, "node_modules", "old-dep"), {
                name: "old-dep",
                version: "2.0.0",
                engines: { node: ">=16" }
            });
        });

        afterEach(() => {
            rmSync(enginesProjectDirectory, { recursive: true, force: true });
        });

        it("runs engines check and reports EOL findings for the root and dependency", async () => {
            const container = setupContainer();
            const { runner, command } = runPipeline({ container });
            const context = command.context({ check: "engines", format: "json" });
            context.dataDirectory = enginesProjectDirectory;

            await runner.run({ steps: command.steps(), context });

            const jsonText = findJsonConsoleCall(consoleSpy, '"findings"');
            const parsed = JSON.parse(jsonText);

            expect(parsed.findings.engines.length).toBeGreaterThanOrEqual(2);

            const rootFinding = parsed.findings.engines.find(
                (finding: { isRoot: boolean }) => finding.isRoot
            );
            expect(rootFinding).toMatchObject({
                packageName: "engines-root",
                enginesNode: ">=16",
                status: "eol"
            });

            const dependencyFinding = parsed.findings.engines.find(
                (finding: { packageName: string }) => finding.packageName === "old-dep"
            );
            expect(dependencyFinding).toMatchObject({
                packageName: "old-dep",
                enginesNode: ">=16",
                status: "eol"
            });
        });

        it("sets exit code 1 when the root engines.node is EOL", async () => {
            // CheckLicensesStep always runs and would independently flag
            // gpl-licensed as a violation (default allowedRiskTiers is
            // ["permissive"]), which would also set exit code 1. Excluding
            // it here isolates the assertion to the engines EOL branch of
            // applyExitCode (see RenderOutputStep.ts).
            const container = setupContainer({
                packages: FIXTURE_PACKAGES.filter(
                    packageEntry => packageEntry.name !== "gpl-licensed"
                )
            });
            const { runner, command } = runPipeline({ container });
            const context = command.context({ check: "engines", format: "table" });
            context.dataDirectory = enginesProjectDirectory;

            await runner.run({ steps: command.steps(), context });

            expect(process.exitCode).toBe(1);
        });
    });
});
