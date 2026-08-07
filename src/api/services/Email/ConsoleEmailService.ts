import { EmailService } from "./abstractions/EmailService.js";
import { AppLogService } from "../AppLog/index.js";

class ConsoleEmailServiceImpl implements EmailService.Interface {
    public constructor(private readonly appLogService: AppLogService.Interface) {}

    public async send(params: EmailService.SendParams): Promise<void> {
        try {
            const lines = [
                `To: ${params.to}`,
                `Subject: ${params.subject}`,
                `Body: ${params.text}`
            ];

            console.log(`[Email] ${lines.join(" | ")}`);

            await this.appLogService.log(
                "info",
                "email",
                null,
                `Email sent to ${params.to}: ${params.subject}`
            );
        } catch {
            // ConsoleEmailService must never throw
        }
    }
}

export const ConsoleEmailService = EmailService.createImplementation({
    implementation: ConsoleEmailServiceImpl,
    dependencies: [AppLogService]
});
