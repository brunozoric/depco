import { sql, type SQL } from "drizzle-orm";

export function teamProjectIds(teamId: string): SQL {
    return sql`(SELECT project_id FROM team_projects WHERE team_id = ${teamId})`;
}
