import { describe, it, expect } from "vitest";
import { resolveTemplate } from "../resolveTemplate.js";

describe("resolveTemplate", () => {
    const fixedDate = new Date("2026-07-22T12:00:00Z");

    it("replaces date tokens", () => {
        const result = resolveTemplate("chore/update-${YYYY}-${MM}-${DD}", {
            date: fixedDate
        });
        expect(result).toBe("chore/update-2026-07-22");
    });

    it("replaces branch token", () => {
        const result = resolveTemplate("from-${BRANCH}", { branch: "main" });
        expect(result).toBe("from-main");
    });

    it("replaces project token", () => {
        const result = resolveTemplate("${PROJECT}-upgrade", { project: "webiny-js" });
        expect(result).toBe("webiny-js-upgrade");
    });

    it("replaces multiple tokens in one template", () => {
        const result = resolveTemplate("${PROJECT}/chore/deps-${YYYY}-${MM}-${DD}", {
            date: fixedDate,
            project: "webiny-js"
        });
        expect(result).toBe("webiny-js/chore/deps-2026-07-22");
    });

    it("leaves unknown tokens untouched", () => {
        const result = resolveTemplate("${UNKNOWN}-${YYYY}", { date: fixedDate });
        expect(result).toBe("${UNKNOWN}-2026");
    });

    it("uses current date when date not provided", () => {
        const result = resolveTemplate("${YYYY}", {});
        const year = new Date().getUTCFullYear().toString();
        expect(result).toBe(year);
    });
});
