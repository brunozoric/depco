import { Octokit } from "@octokit/rest";
import { Gitlab } from "@gitbeaker/rest";
import { eq } from "drizzle-orm";
import { ForgeService as Abstraction } from "./abstractions/ForgeService.js";
import type { ForgeType, IParsedRemote } from "./abstractions/ForgeService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { EncryptionService } from "./abstractions/EncryptionService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appSettings } from "#api/db/schema.js";

export class ForgeServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly commandRunner: CommandRunner.Interface,
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly encryptionService: EncryptionService.Interface
    ) {}

    public async detectForge(projectPath: string): Promise<ForgeType> {
        const result = await this.commandRunner.run("git", ["remote", "get-url", "origin"], {
            cwd: projectPath
        });

        const url = result.stdout.trim();

        if (url.includes("github.com")) {
            return "github";
        }
        if (url.includes("gitlab.com")) {
            return "gitlab";
        }
        return "unknown";
    }

    public async createPr(params: Abstraction.CreatePrParams): Promise<Abstraction.PrResult> {
        const remoteResult = await this.commandRunner.run("git", ["remote", "get-url", "origin"], {
            cwd: params.projectPath
        });
        const remoteUrl = remoteResult.stdout.trim();
        const forge = await this.detectForge(params.projectPath);
        if (forge === "unknown") {
            throw new Error("Cannot detect git forge from remote URL");
        }
        const parsed = this.parseRemoteUrl(remoteUrl);

        if (forge === "github") {
            return this.createGitHubPr(parsed, params);
        }

        return this.createGitLabPr(parsed, remoteUrl, params);
    }

    private async createGitHubPr(
        parsed: IParsedRemote,
        params: Abstraction.CreatePrParams
    ): Promise<Abstraction.PrResult> {
        const token = await this.getToken("github_token");
        if (!token) {
            throw new Error("GitHub token not configured. Set it in Settings > Pull Requests.");
        }

        const octokit = new Octokit({ auth: token });
        const response = await octokit.pulls.create({
            owner: parsed.owner,
            repo: parsed.repo,
            title: params.title,
            body: params.body,
            head: params.head,
            base: params.base
        });

        return {
            url: response.data.html_url,
            number: response.data.number
        };
    }

    private async createGitLabPr(
        parsed: IParsedRemote,
        remoteUrl: string,
        params: Abstraction.CreatePrParams
    ): Promise<Abstraction.PrResult> {
        const token = await this.getToken("gitlab_token");
        if (!token) {
            throw new Error("GitLab token not configured. Set it in Settings > Pull Requests.");
        }

        let host: string;
        if (remoteUrl.includes("://")) {
            host = new URL(remoteUrl).origin;
        } else {
            const sshHostMatch = remoteUrl.match(/^git@([^:]+):/);
            host = sshHostMatch ? `https://${sshHostMatch[1]}` : "https://gitlab.com";
        }

        const projectPath = `${parsed.owner}/${parsed.repo}`;
        const gitlab = new Gitlab({ token, host });
        const mr = await gitlab.MergeRequests.create(
            projectPath,
            params.head,
            params.base,
            params.title,
            { description: params.body }
        );

        return {
            url: mr.web_url,
            number: mr.iid
        };
    }

    private async getToken(key: string): Promise<string | null> {
        const row = await this.databaseClient.db
            .select()
            .from(appSettings)
            .where(eq(appSettings.key, key))
            .get();

        if (!row?.value) {
            return null;
        }

        return this.encryptionService.decrypt(row.value);
    }

    public parseRemoteUrl(url: string): IParsedRemote {
        const cleaned = url.trim().replace(/\.git$/, "");

        const sshMatch = cleaned.match(/^git@[^:]+:(.+)$/);
        if (sshMatch) {
            const parts = sshMatch[1]!.split("/");
            const repo = parts.pop()!;
            const owner = parts.join("/");
            return { owner, repo };
        }

        const httpsMatch = cleaned.match(/https?:\/\/[^/]+\/(.+)$/);
        if (httpsMatch) {
            const parts = httpsMatch[1]!.split("/");
            const repo = parts.pop()!;
            const owner = parts.join("/");
            return { owner, repo };
        }

        throw new Error(`Cannot parse remote URL: ${url}`);
    }
}

export const ForgeService = Abstraction.createImplementation({
    implementation: ForgeServiceImpl,
    dependencies: [CommandRunner, DatabaseClient, EncryptionService]
});
