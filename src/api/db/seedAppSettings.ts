import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { appSettings } from "./schema.js";

interface IDefaultSetting {
    key: string;
    value: string;
}

const DEFAULT_SETTINGS: IDefaultSetting[] = [
    {
        key: "branch_template",
        value: "chore/update-dependencies-${YYYY}-${MM}-${DD}"
    },
    {
        key: "commit_template",
        value: "chore: update dependencies ${YYYY}-${MM}-${DD}"
    },
    {
        key: "log_level",
        value: "warn"
    },
    {
        key: "snooze_check_interval",
        value: "3600000"
    },
    {
        key: "transitive-resolve-ttl",
        value: "24"
    }
];

export function seedAppSettings(db: BetterSQLite3Database): void {
    for (const setting of DEFAULT_SETTINGS) {
        db.insert(appSettings).values(setting).onConflictDoNothing().run();
    }
}
