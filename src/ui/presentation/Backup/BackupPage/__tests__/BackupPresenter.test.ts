import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { BackupPresenter } from "../abstractions/BackupPresenter.js";
import { BackupPresenter as BackupPresenterRegistration } from "../BackupPresenter.js";

describe("BackupPresenter", () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockAnchor: {
        href: string;
        download: string;
        click: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
    };

    function createPresenter(): BackupPresenter.Interface {
        const container = createContainer();
        container.register(BackupPresenterRegistration);
        return container.resolve(BackupPresenter);
    }

    beforeEach(() => {
        mockFetch = vi.fn();
        vi.stubGlobal("fetch", mockFetch);

        mockCreateObjectURL = vi.fn().mockReturnValue("blob:http://localhost/fake-url");
        mockRevokeObjectURL = vi.fn();
        vi.stubGlobal("URL", {
            createObjectURL: mockCreateObjectURL,
            revokeObjectURL: mockRevokeObjectURL
        });

        mockAnchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
        vi.stubGlobal("document", {
            createElement: vi.fn().mockReturnValue(mockAnchor),
            body: { appendChild: vi.fn() }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should start with idle view model", () => {
        const presenter = createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            error: null,
            importResult: null
        });
    });

    describe("exportBackup()", () => {
        it("should set loading, call fetch, trigger download, and clear loading", async () => {
            const mockBlob = new Blob(["data"], { type: "application/zip" });
            mockFetch.mockResolvedValue({
                ok: true,
                blob: async () => mockBlob
            });

            const presenter = createPresenter();
            await presenter.exportBackup();

            expect(mockFetch).toHaveBeenCalledWith("/api/Projects/backup");
            expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
            expect(mockAnchor.click).toHaveBeenCalled();
            expect(mockAnchor.remove).toHaveBeenCalled();
            expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/fake-url");
            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.error).toBeNull();
        });

        it("should set error on fetch failure", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500
            });

            const presenter = createPresenter();
            await presenter.exportBackup();

            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.error).toBe("Export failed: 500");
        });
    });

    describe("importBackup()", () => {
        it("should set loading, post file, store result, and clear loading", async () => {
            const importResult = {
                appSettings: { imported: 1, skipped: 0 },
                securitySettings: { imported: 0, skipped: 0 },
                projects: { imported: 2, skipped: 1, failed: 0, errors: [] },
                dependencies: { imported: 5, skipped: 0 },
                registryCache: { imported: 3, skipped: 0 }
            };
            const mockArrayBuffer = new ArrayBuffer(8);
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => importResult
            });

            const file = new File(["backup-data"], "backup.zip", { type: "application/zip" });
            vi.spyOn(file, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

            const presenter = createPresenter();
            await presenter.importBackup(file);

            expect(mockFetch).toHaveBeenCalledWith("/api/Projects/backup", {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream" },
                body: mockArrayBuffer
            });
            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.error).toBeNull();
            expect(presenter.vm.importResult).toEqual(importResult);
        });

        it("should set error on failure", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 422
            });

            const file = new File(["bad-data"], "backup.zip");

            const presenter = createPresenter();
            await presenter.importBackup(file);

            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.error).toBe("Import failed: 422");
            expect(presenter.vm.importResult).toBeNull();
        });
    });

    describe("clearResult()", () => {
        it("should clear importResult", async () => {
            const importResult = {
                appSettings: { imported: 1, skipped: 0 },
                securitySettings: { imported: 0, skipped: 0 },
                projects: { imported: 0, skipped: 0, failed: 0, errors: [] },
                dependencies: { imported: 0, skipped: 0 },
                registryCache: { imported: 0, skipped: 0 }
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => importResult
            });

            const file = new File(["data"], "backup.zip");

            const presenter = createPresenter();
            await presenter.importBackup(file);
            expect(presenter.vm.importResult).toEqual(importResult);

            presenter.clearResult();
            expect(presenter.vm.importResult).toBeNull();
        });
    });
});
