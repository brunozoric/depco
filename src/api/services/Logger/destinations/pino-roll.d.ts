declare module "pino-roll" {
    import type { SonicBoom, SonicBoomOpts } from "sonic-boom";

    export interface IRollOptions extends SonicBoomOpts {
        file: string | (() => string);
        frequency?: "daily" | "hourly" | number;
        size?: string | number;
        limit?: { count?: number; removeOtherLogFiles?: boolean };
        extension?: string;
        dateFormat?: string;
        symlink?: boolean;
    }

    export default function buildStream(options: IRollOptions): Promise<SonicBoom>;
}
