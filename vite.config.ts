import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    resolve: {
        conditions: ["source"]
    },
    build: {
        outDir: "dist/ui"
    },
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:3001",
                configure: proxy => {
                    proxy.on("proxyReq", proxyReq => {
                        proxyReq.removeHeader("accept-encoding");
                    });
                }
            },
            "/ws": {
                target: "ws://localhost:3001",
                ws: true
            }
        }
    }
});
