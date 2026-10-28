import { EmailService } from "./abstractions/EmailService.js";
import { AppLogService } from "../AppLog/index.js";

class ConsoleEmailServiceImpl implements EmailService.Interface {
    public constructor(private readonly appLogService: AppLogService.Interface) {}

    public async send(params: EmailService.SendParams): Promise<void> {
        try {
            // No real email transport yet, so stdout is the only place the body
            // (login code, magic link) shows up. Keep it out of the app log —
            // that lands in the DB and the Logs page, where anyone with log
            // access could read other users' login codes.
            console.log(
                `[Email] To: ${params.to} | Subject: ${params.subject} | Body: ${params.text}`
            );

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
