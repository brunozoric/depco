import { GitService as Abstraction } from "./abstractions/GitService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";

class GitServiceImpl implements Abstraction.Interface {
    public constructor(private readonly commandRunner: CommandRunner.Interface) {}

    public async getCurrentBranch(projectPath: string): Promise<string> {
        const result = await this.commandRunner.run("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
            cwd: projectPath
        });
        return result.stdout.trim();
    }

    public async createAndCheckoutBranch(projectPath: string, branchName: string): Promise<void> {
        await this.commandRunner.run("git", ["checkout", "-b", branchName], {
            cwd: projectPath
        });
    }

    public async checkout(projectPath: string, branchName: string): Promise<void> {
        await this.commandRunner.run("git", ["checkout", branchName], {
            cwd: projectPath
        });
    }

    public async getStatus(projectPath: string): Promise<string[]> {
        const result = await this.commandRunner.run("git", ["status", "--porcelain"], {
            cwd: projectPath
        });
        return result.stdout.split("\n").filter(line => line.length > 0);
    }

    public async stageAll(projectPath: string): Promise<void> {
        await this.commandRunner.run("git", ["add", "-A"], { cwd: projectPath });
    }

    public async commit(projectPath: string, message: string): Promise<string> {
        await this.commandRunner.run("git", ["commit", "-m", message], {
            cwd: projectPath
        });
        const result = await this.commandRunner.run("git", ["rev-parse", "--short", "HEAD"], {
            cwd: projectPath
        });
        return result.stdout.trim();
    }

    public async push(
        projectPath: string,
        remoteName: string,
        branchName: string
    ): Promise<Abstraction.PushResult> {
        const result = await this.commandRunner.run("git", ["push", "-u", remoteName, branchName], {
            cwd: projectPath
        });

        if (result.exitCode !== 0) {
            return { success: false, output: result.stderr || result.stdout };
        }

        return { success: true, output: result.stdout || result.stderr };
    }
}

export const GitService = Abstraction.createImplementation({
    implementation: GitServiceImpl,
    dependencies: [CommandRunner]
});
