import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

export default defineConfig({
    resolve: {
        conditions: ["source"]
    },
    ssr: {
        resolve: {
            conditions: ["source"]
        }
    },
    test: {
        root,
        include: ["src/**/__tests__/**/*.test.ts"],
        fileParallelism: false,
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/__tests__/**",
                "src/**/*.test.ts",
                "src/**/migrations/**",
                "src/**/abstractions/**",
                "src/**/index.ts",
                "src/api/server.ts",
                "src/api/feature.ts",
                "src/api/db/client.ts",
                "src/api/db/migrate.ts",
                "src/api/websocket/WebSocketPlugin.ts",
                "src/ui/shared/router/router.ts",
                "src/ui/shared/di/useFeature.ts",
                "src/**/feature.ts",
                "src/api/db/schema.ts"
            ]
        }
    }
});
