import { createAbstraction } from "#shared/index.js";

export interface IEmailSendParams {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export interface IEmailService {
    send(params: IEmailSendParams): Promise<void>;
}

export const EmailService = createAbstraction<IEmailService>("Api/EmailService");

export namespace EmailService {
    export type Interface = IEmailService;
    export type SendParams = IEmailSendParams;
}
