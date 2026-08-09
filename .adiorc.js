export default {
    ignore: {
        src: ["#api", "#shared", "#testing", "#ui"],
        dependencies: [
            "@types/react",
            "react-dom",
            "@emotion/react",
            "@mantine/hooks",
            "concurrently",
            // peer dependency by recharts
            "react-is",
            "typescript",
            // wired up in a later CLI task (command parsing not yet implemented)
            "yargs"
        ],
        devDependencies: true,
        peerDependencies: true
    },
    ignoreDirs: ["node_modules/", "dist/", "build/"],
    packages: ["./"]
};
