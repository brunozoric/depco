import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@mantine/notifications", () => ({
    notifications: {
        show: vi.fn(),
        hide: vi.fn()
    }
}));

vi.mock("../../router/router.js", () => ({
    navigate: vi.fn()
}));

import { createJobStatusNotificationHandler } from "../jobNotifications.js";
import { notifications } from "@mantine/notifications";
import { navigate } from "../../router/router.js";
import { ProjectsRepository } from "#ui/features/projects/abstractions/ProjectsRepository.js";

interface NotificationClickHandler {
    onClick: () => void;
}

interface MockContainer {
    resolve: (abstraction: unknown) => unknown;
}

function createMockContainer(projectName?: string): MockContainer {
    return {
        resolve: (abstraction: unknown) => {
            if (abstraction === ProjectsRepository) {
                return {
                    getProject: () =>
                        projectName !== undefined ? { name: projectName } : undefined
                };
            }
            return undefined;
        }
    };
}

describe("createJobStatusNotificationHandler", () => {
    let handler: (data: {
        jobId: string;
        referenceId: string;
        referenceType: string;
        type: string;
        status: string;
    }) => void;

    beforeEach(() => {
        vi.clearAllMocks();
        handler = createJobStatusNotificationHandler(createMockContainer() as never);
    });

    it("shows green notification on completed job", () => {
        handler({
            jobId: "job-1",
            referenceId: "proj-1",
            referenceType: "project",
            type: "dependency",
            status: "completed"
        });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "job-1",
                color: "green",
                title: "✓ Dependency job completed",
                autoClose: 5000
            })
        );
    });

    it("shows red sticky notification on failed job", () => {
        handler({
            jobId: "job-2",
            referenceId: "proj-1",
            referenceType: "project",
            type: "scan",
            status: "failed"
        });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "job-2",
                color: "red",
                title: "✕ Scan job failed",
                autoClose: false
            })
        );
    });

    it("shows yellow notification on cancelled job", () => {
        handler({
            jobId: "job-3",
            referenceId: "proj-1",
            referenceType: "project",
            type: "install",
            status: "cancelled"
        });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "job-3",
                color: "yellow",
                title: "⚠ Install job cancelled",
                autoClose: 5000
            })
        );
    });

    it("humanizes camelCase job types", () => {
        handler({
            jobId: "job-4",
            referenceId: "proj-1",
            referenceType: "project",
            type: "packageManager",
            status: "completed"
        });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "✓ Package manager job completed"
            })
        );
    });

    it("ignores non-terminal statuses", () => {
        handler({
            jobId: "job-5",
            referenceId: "proj-1",
            referenceType: "project",
            type: "scan",
            status: "pending"
        });

        handler({
            jobId: "job-6",
            referenceId: "proj-1",
            referenceType: "project",
            type: "scan",
            status: "running"
        });

        expect(notifications.show).not.toHaveBeenCalled();
    });

    it("navigates to /jobs and hides notification on click", () => {
        handler({
            jobId: "job-7",
            referenceId: "proj-1",
            referenceType: "project",
            type: "dependency",
            status: "completed"
        });

        const firstCall = vi.mocked(notifications.show).mock.calls[0];
        if (!firstCall) {
            throw new Error("Expected notifications.show to have been called");
        }
        const call = firstCall[0] as unknown as NotificationClickHandler;
        call.onClick();

        expect(navigate).toHaveBeenCalledWith("/jobs");
        expect(notifications.hide).toHaveBeenCalledWith("job-7");
    });

    it("includes project name in title when available", () => {
        const handlerWithProject = createJobStatusNotificationHandler(
            createMockContainer("MyProject") as never
        );

        handlerWithProject({
            jobId: "job-8",
            referenceId: "proj-1",
            referenceType: "project",
            type: "dependency",
            status: "completed"
        });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "✓ Dependency job completed — MyProject"
            })
        );
    });

    it("omits project name when repository returns undefined", () => {
        handler({
            jobId: "job-9",
            referenceId: "proj-unknown",
            referenceType: "project",
            type: "scan",
            status: "completed"
        });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "✓ Scan job completed"
            })
        );
    });

    it("shows referenceId as suffix for non-project referenceType", () => {
        handler({
            jobId: "job-10",
            referenceId: "@scope/my-package",
            referenceType: "package",
            type: "dependency",
            status: "completed"
        });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "✓ Dependency job completed — @scope/my-package"
            })
        );
    });
});
