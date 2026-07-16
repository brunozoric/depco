export interface TemplateContext {
    date?: Date;
    branch?: string;
    project?: string;
    count?: number;
    packagesTable?: string;
}

export function resolveTemplate(template: string, context: TemplateContext): string {
    const date = context.date ?? new Date();
    const yyyy = date.getUTCFullYear().toString();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");

    const tokens: Record<string, string> = {
        YYYY: yyyy,
        MM: mm,
        DD: dd
    };

    if (context.branch !== undefined) {
        tokens["BRANCH"] = context.branch;
    }
    if (context.project !== undefined) {
        tokens["PROJECT"] = context.project;
    }
    if (context.count !== undefined) {
        tokens["COUNT"] = String(context.count);
    }
    if (context.packagesTable !== undefined) {
        tokens["PACKAGES_TABLE"] = context.packagesTable;
    }

    return template.replace(/\$\{(\w+)\}/g, (match, key: string) => {
        return key in tokens ? tokens[key]! : match;
    });
}
