import type { INodeRelease } from "./types.js";

/**
 * Embedded fallback Node.js release schedule.
 *
 * Dates verified against https://nodejs.org/en/about/previous-releases and the
 * official schedule at https://github.com/nodejs/Release#release-schedule.
 *
 * Odd-numbered releases (17, 19, 21, 23) never enter Active LTS — they go
 * straight from "Current" into a maintenance-style support window before
 * reaching end-of-life, so `ltsStart` is `null` and `codename` is `null` for
 * those versions.
 */
export const NODE_RELEASES: INodeRelease[] = [
    {
        version: 16,
        codename: "Gallium",
        releaseDate: Date.UTC(2021, 3, 20),
        ltsStart: Date.UTC(2021, 9, 26),
        maintenanceStart: Date.UTC(2022, 9, 18),
        eolDate: Date.UTC(2023, 8, 11)
    },
    {
        version: 17,
        codename: null,
        releaseDate: Date.UTC(2021, 9, 19),
        ltsStart: null,
        maintenanceStart: Date.UTC(2022, 3, 1),
        eolDate: Date.UTC(2022, 5, 1)
    },
    {
        version: 18,
        codename: "Hydrogen",
        releaseDate: Date.UTC(2022, 3, 19),
        ltsStart: Date.UTC(2022, 9, 25),
        maintenanceStart: Date.UTC(2023, 9, 18),
        eolDate: Date.UTC(2025, 3, 30)
    },
    {
        version: 19,
        codename: null,
        releaseDate: Date.UTC(2022, 9, 18),
        ltsStart: null,
        maintenanceStart: Date.UTC(2023, 3, 1),
        eolDate: Date.UTC(2023, 5, 1)
    },
    {
        version: 20,
        codename: "Iron",
        releaseDate: Date.UTC(2023, 3, 18),
        ltsStart: Date.UTC(2023, 9, 24),
        maintenanceStart: Date.UTC(2024, 9, 22),
        eolDate: Date.UTC(2026, 3, 30)
    },
    {
        version: 21,
        codename: null,
        releaseDate: Date.UTC(2023, 9, 17),
        ltsStart: null,
        maintenanceStart: Date.UTC(2024, 3, 1),
        eolDate: Date.UTC(2024, 5, 1)
    },
    {
        version: 22,
        codename: "Jod",
        releaseDate: Date.UTC(2024, 3, 24),
        ltsStart: Date.UTC(2024, 9, 29),
        maintenanceStart: Date.UTC(2025, 9, 21),
        eolDate: Date.UTC(2027, 3, 30)
    },
    {
        version: 23,
        codename: null,
        releaseDate: Date.UTC(2024, 9, 16),
        ltsStart: null,
        maintenanceStart: Date.UTC(2025, 3, 1),
        eolDate: Date.UTC(2025, 5, 1)
    },
    {
        version: 24,
        codename: "Krypton",
        releaseDate: Date.UTC(2025, 4, 6),
        ltsStart: Date.UTC(2025, 9, 28),
        maintenanceStart: Date.UTC(2026, 9, 20),
        eolDate: Date.UTC(2028, 3, 30)
    }
];
